import { readFile } from 'node:fs/promises'
import path from 'node:path'
import JSON5 from 'json5'
import { findFolderWith, isErrnoException, isRecord } from '../store/files'
import { EAS_PLATFORMS, type EasPlatform } from './build'

/** A build profile to sync, and the platforms whose builds DevHub keeps. */
export type SyncProfile = {
  name: string
  platforms: EasPlatform[]
}

export type DevClientProfiles = {
  profiles: SyncProfile[]
  warnings: string[]
}

type Profile = Record<string, unknown>

/** eas-cli stops an `extends` chain at the same depth. */
const MAX_EXTENDS_DEPTH = 5

export class EasJsonError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EasJsonError'
  }
}

/**
 * Finds the project folder: the start folder, or the nearest parent folder,
 * that has an eas.json. Returns the real path, so that one project has one
 * entry in projects.json.
 */
export function findEasProject(start: string): Promise<string | undefined> {
  return findFolderWith(start, 'eas.json')
}

export async function readEasJson(projectDir: string): Promise<unknown> {
  const file = path.join(projectDir, 'eas.json')
  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      throw new EasJsonError(
        `${projectDir} has no eas.json. Run devhub sync in the folder of an EAS project.`,
      )
    }
    throw error
  }
  return parseEasJson(text, file)
}

/** eas-cli reads eas.json as JSON, and then as JSON5. DevHub does the same. */
export function parseEasJson(text: string, file = 'eas.json'): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    // eas.json can have comments and trailing commas.
  }
  try {
    return JSON5.parse(text) as unknown
  } catch (error) {
    throw new EasJsonError(
      `${file} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Finds each build profile that makes a development client, with the merge
 * rules of eas-cli: a profile extends its base, and the `android` or `ios`
 * block overrides the common keys for that platform. A profile that cannot
 * resolve gives a warning, and the other profiles continue.
 */
export function devClientProfiles(easJson: unknown): DevClientProfiles {
  const build =
    isRecord(easJson) && isRecord(easJson.build) ? easJson.build : {}
  const profiles: SyncProfile[] = []
  const warnings: string[] = []
  for (const name of Object.keys(build)) {
    let resolved: Profile
    try {
      resolved = resolveProfile(build, name)
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error))
      continue
    }
    const platforms = EAS_PLATFORMS.filter(
      (platform) => forPlatform(resolved, platform).developmentClient === true,
    )
    if (platforms.length > 0) {
      profiles.push({ name, platforms })
    }
  }
  return { profiles, warnings }
}

/** Adds each `--profile` name for both platforms. */
export function withExtraProfiles(
  profiles: readonly SyncProfile[],
  extra: readonly string[],
): SyncProfile[] {
  const result = profiles.map((profile) => ({
    ...profile,
    platforms: [...profile.platforms],
  }))
  for (const name of extra) {
    const existing = result.find((profile) => profile.name === name)
    if (existing) {
      existing.platforms = [...EAS_PLATFORMS]
    } else {
      result.push({ name, platforms: [...EAS_PLATFORMS] })
    }
  }
  return result
}

function resolveProfile(
  build: Record<string, unknown>,
  root: string,
  name = root,
  depth = 0,
): Profile {
  if (depth >= MAX_EXTENDS_DEPTH) {
    throw new EasJsonError(
      `The build profile "${root}" is skipped: its "extends" chain is longer than ${MAX_EXTENDS_DEPTH} profiles, or it has a cycle.`,
    )
  }
  const profile = build[name]
  if (!isRecord(profile)) {
    throw new EasJsonError(
      depth === 0
        ? `The build profile "${root}" is skipped: it is not an object.`
        : `The build profile "${root}" is skipped: it extends "${name}", and eas.json has no build profile with that name.`,
    )
  }
  const { extends: base, ...rest } = profile
  if (typeof base !== 'string') {
    return rest
  }
  return mergeProfiles(resolveProfile(build, root, base, depth + 1), rest)
}

function mergeProfiles(base: Profile, update: Profile): Profile {
  const result: Profile = { ...base, ...update }
  for (const key of ['android', 'ios']) {
    const baseBlock = base[key]
    const updateBlock = update[key]
    if (isRecord(baseBlock) && isRecord(updateBlock)) {
      result[key] = mergeProfiles(baseBlock, updateBlock)
    }
  }
  return result
}

function forPlatform(profile: Profile, platform: EasPlatform): Profile {
  const { android, ios, ...common } = profile
  const block = platform === 'ANDROID' ? android : ios
  return isRecord(block) ? { ...common, ...block } : common
}
