import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import {
  EAS_PLATFORMS,
  isEasBuild,
  type EasBuild,
  type EasPlatform,
} from '../eas/build'
import {
  isErrnoException,
  isRecord,
  readJsonFile,
  writeJsonAtomic,
} from './files'

/**
 * An EAS record keeps version 1, so DevHub 0.0.0-alpha.0 still reads it. A
 * local record has version 2, which that DevHub calls "written by a newer
 * DevHub".
 */
export const EAS_RECORD_SCHEMA_VERSION = 1
export const LOCAL_RECORD_SCHEMA_VERSION = 2
export const BUILD_RECORD_FILE = 'build.json'

export type EasBuildRecord = {
  schemaVersion: typeof EAS_RECORD_SCHEMA_VERSION
  storedAt: string
  file: string
  size: number
  sha256: string
  eas: EasBuild
}

/** A build that `npx expo run:*` made on this machine. */
export type LocalBuild = {
  platform: EasPlatform
  /** The fingerprint of the project for this platform, the same kind as EAS. */
  fingerprintHash: string
  /** Android: the Gradle variant, for example `debug`. iOS: the Xcode configuration, for example `Debug`. */
  variant: string
  /** The real path of the project folder. */
  project: string
  /** The `slug` of the app config. */
  slug?: string
  appIdentifier?: string
  appVersion?: string
  sdkVersion?: string
  gitCommitHash?: string
  /** Android: the ABIs of the native code in the APK. */
  abis?: string[]
  /** iOS: `process.arch` of the Mac that made the build. */
  hostArch?: string
}

export type LocalBuildRecord = {
  schemaVersion: typeof LOCAL_RECORD_SCHEMA_VERSION
  source: 'local'
  storedAt: string
  file: string
  size: number
  sha256: string
  local: LocalBuild
}

export type BuildRecord = EasBuildRecord | LocalBuildRecord

export function isLocalRecord(record: BuildRecord): record is LocalBuildRecord {
  return record.schemaVersion === LOCAL_RECORD_SCHEMA_VERSION
}

export type StoredBuild = {
  id: string
  /** The absolute path of the build file. */
  path: string
  record: BuildRecord
}

export type UnreadableBuild = { id: string; reason: string }

export type StoreScan = {
  builds: StoredBuild[]
  /** Build folders with no build.json. The next sync replaces them. */
  incomplete: string[]
  unreadable: UnreadableBuild[]
}

export function buildsRoot(home: string): string {
  return path.join(home, 'builds')
}

export function buildFolder(home: string, id: string): string {
  return path.join(buildsRoot(home), id)
}

/** The fix for a stored build file that is missing or damaged. */
export function downloadAgainFix(file: string): string {
  return `Delete the folder ${path.dirname(file)}, and then run devhub sync in the project to download the build again.`
}

/** An EAS build ID is a UUID. The check keeps a bad ID out of a path. */
export function isSafeBuildId(id: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9-]*$/.test(id)
}

/** A record file name must stay inside its build folder. */
export function isSafeFileName(name: string): boolean {
  return (
    /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(name) && name !== BUILD_RECORD_FILE
  )
}

/**
 * Returns the IDs of the folders that have a build.json. The content of the
 * file does not matter here: a sync must never replace a record, even one
 * that a newer DevHub wrote.
 */
export async function storedBuildIds(home: string): Promise<Set<string>> {
  const ids = new Set<string>()
  for (const id of await buildFolderNames(home)) {
    if (await exists(path.join(buildFolder(home, id), BUILD_RECORD_FILE))) {
      ids.add(id)
    }
  }
  return ids
}

export async function scanStore(home: string): Promise<StoreScan> {
  const scan: StoreScan = { builds: [], incomplete: [], unreadable: [] }
  for (const id of await buildFolderNames(home)) {
    const folder = buildFolder(home, id)
    let value: unknown
    try {
      value = await readJsonFile(path.join(folder, BUILD_RECORD_FILE))
    } catch (error) {
      scan.unreadable.push({
        id,
        reason: `build.json cannot be read: ${error instanceof Error ? error.message : String(error)}`,
      })
      continue
    }
    if (value === undefined) {
      scan.incomplete.push(id)
      continue
    }
    const reason = recordProblem(value, id)
    if (reason !== undefined) {
      scan.unreadable.push({ id, reason })
      continue
    }
    const record = value as BuildRecord
    scan.builds.push({ id, path: path.join(folder, record.file), record })
  }
  return scan
}

export type FindResult =
  | { kind: 'found'; build: StoredBuild }
  | { kind: 'none' }
  | { kind: 'ambiguous'; matches: StoredBuild[] }

/** Finds a build by its full EAS build ID, or by a unique prefix of it. */
export function findBuild(
  builds: readonly StoredBuild[],
  idOrPrefix: string,
): FindResult {
  const query = idOrPrefix.toLowerCase()
  const exact = builds.find((build) => build.id.toLowerCase() === query)
  if (exact) {
    return { kind: 'found', build: exact }
  }
  const matches = builds.filter((build) =>
    build.id.toLowerCase().startsWith(query),
  )
  if (matches.length === 0) {
    return { kind: 'none' }
  }
  if (matches.length === 1 && matches[0]) {
    return { kind: 'found', build: matches[0] }
  }
  return { kind: 'ambiguous', matches }
}

/**
 * Makes an empty folder for a new build. An incomplete folder from an
 * interrupted sync is deleted first. Call it only with the sync lock.
 */
export async function prepareBuildFolder(
  home: string,
  id: string,
): Promise<string> {
  if (!isSafeBuildId(id)) {
    throw new Error(`"${id}" is not a valid EAS build ID.`)
  }
  const folder = buildFolder(home, id)
  if (await exists(path.join(folder, BUILD_RECORD_FILE))) {
    throw new Error(`The build ${id} is already stored at ${folder}.`)
  }
  await rm(folder, { recursive: true, force: true })
  await mkdir(folder, { recursive: true })
  return folder
}

export async function writeBuildRecord(
  folder: string,
  record: BuildRecord,
): Promise<void> {
  await writeJsonAtomic(path.join(folder, BUILD_RECORD_FILE), record)
}

async function buildFolderNames(home: string): Promise<string[]> {
  let entries
  try {
    entries = await readdir(buildsRoot(home), { withFileTypes: true })
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return []
    }
    throw error
  }
  return entries
    .filter((entry) => entry.isDirectory() && isSafeBuildId(entry.name))
    .map((entry) => entry.name)
    .sort()
}

function recordProblem(value: unknown, id: string): string | undefined {
  if (!isRecord(value)) {
    return 'build.json is not a JSON object.'
  }
  const { schemaVersion } = value
  if (
    typeof schemaVersion === 'number' &&
    schemaVersion > LOCAL_RECORD_SCHEMA_VERSION
  ) {
    return `build.json has schema version ${schemaVersion}. A newer DevHub wrote it. Update DevHub.`
  }
  const fields =
    typeof value.storedAt === 'string' &&
    typeof value.file === 'string' &&
    isSafeFileName(value.file) &&
    typeof value.size === 'number' &&
    typeof value.sha256 === 'string'
  if (schemaVersion === LOCAL_RECORD_SCHEMA_VERSION) {
    return fields && value.source === 'local' && isLocalBuild(value.local)
      ? undefined
      : 'build.json does not have the fields of a local build record.'
  }
  if (
    schemaVersion !== EAS_RECORD_SCHEMA_VERSION ||
    !fields ||
    !isEasBuild(value.eas)
  ) {
    return 'build.json does not have the fields of a build record.'
  }
  if (value.eas.id !== id) {
    return `build.json is for the build ${value.eas.id}, not for ${id}.`
  }
  return undefined
}

const LOCAL_STRING_FIELDS = [
  'slug',
  'appIdentifier',
  'appVersion',
  'sdkVersion',
  'gitCommitHash',
  'hostArch',
] as const

function isLocalBuild(value: unknown): value is LocalBuild {
  if (!isRecord(value)) {
    return false
  }
  return (
    EAS_PLATFORMS.includes(value.platform as EasPlatform) &&
    typeof value.fingerprintHash === 'string' &&
    value.fingerprintHash !== '' &&
    typeof value.variant === 'string' &&
    typeof value.project === 'string' &&
    LOCAL_STRING_FIELDS.every(
      (field) => value[field] === undefined || typeof value[field] === 'string',
    ) &&
    (value.abis === undefined ||
      (Array.isArray(value.abis) &&
        value.abis.every((abi) => typeof abi === 'string')))
  )
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file)
    return true
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return false
    }
    throw error
  }
}
