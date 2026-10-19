import { randomUUID } from 'node:crypto'
import { copyFile, mkdir, readdir, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { apkAbis } from '../binary/apk'
import { outputTail, type CommandRunner } from '../command/run-command'
import { runTool } from '../devices/device'
import { tarCreateCommand } from '../install/unpack'
import {
  LOCAL_RECORD_SCHEMA_VERSION,
  buildFolder,
  buildsRoot,
  writeBuildRecord,
  type LocalBuild,
  type LocalBuildRecord,
  type StoredBuild,
} from '../store/builds'
import { hashFile } from '../store/files'

export const TAR_PACK_MISSING =
  'DevHub cannot find tar, which it needs to store an iOS simulator build. Install tar, and then run the command again.'

/** A temporary folder is older than this only after a crash. */
const STALE_TEMP_MS = 24 * 60 * 60 * 1000

/** `scanStore` skips a folder name that starts with `.`. */
const TEMP_PREFIX = '.tmp-'

export type LocalBuildInput = {
  /** The APK of an Android build, or the `.app` folder of an iOS simulator build. */
  path: string
  /** DevHub adds `abis` for Android and `hostArch` for iOS. */
  local: Omit<LocalBuild, 'abis' | 'hostArch'>
}

export type StoreLocalOptions = {
  /** The DevHub home, from `resolveHome`. */
  home: string
  run: CommandRunner
  now: () => Date
  /** The architecture of this Mac. The default is `process.arch`. */
  arch?: string
}

/**
 * Copies a build that `npx expo run:*` made into the store, with a new ID.
 * The copy goes into a temporary folder, and the folder gets its name last,
 * so the store never shows half a build.
 */
export async function storeLocalBuild(
  input: LocalBuildInput,
  options: StoreLocalOptions,
): Promise<StoredBuild & { record: LocalBuildRecord }> {
  const id = randomUUID()
  const root = buildsRoot(options.home)
  await mkdir(root, { recursive: true })
  await removeStaleTemp(root, options.now())
  const temp = path.join(root, `${TEMP_PREFIX}${id}`)
  await mkdir(temp)
  try {
    const { file, local } =
      input.local.platform === 'ANDROID'
        ? await copyApk(input, temp)
        : await packApp(input, temp, options)
    const { size, sha256 } = await hashFile(path.join(temp, file))
    const record: LocalBuildRecord = {
      schemaVersion: LOCAL_RECORD_SCHEMA_VERSION,
      source: 'local',
      storedAt: options.now().toISOString(),
      file,
      size,
      sha256,
      local,
    }
    await writeBuildRecord(temp, record)
    const folder = buildFolder(options.home, id)
    await rename(temp, folder)
    return { id, path: path.join(folder, file), record }
  } catch (error) {
    await rm(temp, { recursive: true, force: true })
    throw error
  }
}

async function copyApk(
  input: LocalBuildInput,
  temp: string,
): Promise<{ file: string; local: LocalBuild }> {
  if (!input.path.toLowerCase().endsWith('.apk')) {
    throw new Error(
      `DevHub stores only an .apk for Android, not ${input.path}.`,
    )
  }
  const file = 'app.apk'
  const target = path.join(temp, file)
  await copyFile(input.path, target)
  return { file, local: { ...input.local, abis: await apkAbis(target) } }
}

async function packApp(
  input: LocalBuildInput,
  temp: string,
  options: StoreLocalOptions,
): Promise<{ file: string; local: LocalBuild }> {
  const app = path.resolve(input.path)
  if (!app.endsWith('.app') || !(await stat(app)).isDirectory()) {
    throw new Error(
      `DevHub stores only a .app folder for iOS, not ${input.path}.`,
    )
  }
  const file = 'app.tar.gz'
  const result = await runTool(
    options.run,
    tarCreateCommand(
      path.join(temp, file),
      path.dirname(app),
      path.basename(app),
    ),
    options.home,
    TAR_PACK_MISSING,
  )
  if (result.code !== 0) {
    throw new Error(
      `"tar -czf" failed with exit code ${result.code}.${outputTail(result.stderr)}`,
    )
  }
  return {
    file,
    local: { ...input.local, hostArch: options.arch ?? process.arch },
  }
}

async function removeStaleTemp(root: string, now: Date): Promise<void> {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(TEMP_PREFIX)) {
      continue
    }
    const folder = path.join(root, entry.name)
    try {
      if (now.getTime() - (await stat(folder)).mtimeMs > STALE_TEMP_MS) {
        await rm(folder, { recursive: true, force: true })
      }
    } catch {
      // Another process removed it, or renamed it into the store.
    }
  }
}
