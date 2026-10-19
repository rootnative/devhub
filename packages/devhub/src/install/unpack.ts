import { mkdir, readdir, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import {
  outputTail,
  type Command,
  type CommandRunner,
} from '../command/run-command'
import { DeviceError, runTool } from '../devices/device'
import { downloadAgainFix, type StoredBuild } from '../store/builds'
import { isErrnoException, tempPath } from '../store/files'

export const TAR_MISSING =
  'DevHub cannot find tar, which it needs to unpack an iOS simulator build. Install tar, and then run the command again.'

export type UnpackOptions = {
  run: CommandRunner
  cwd: string
  /** The DevHub home, from `resolveHome`. */
  home: string
}

/** DevHub can delete this folder at any time. The next install unpacks again. */
export function extractedRoot(home: string): string {
  return path.join(home, 'extracted')
}

export function extractedFolder(home: string, id: string): string {
  return path.join(extractedRoot(home), id)
}

export function tarExtractCommand(archive: string, folder: string): Command {
  return ['tar', '-xf', archive, '-C', folder]
}

/** Packs `name` in `folder` into a gzip archive, with `name` at the top. */
export function tarCreateCommand(
  archive: string,
  folder: string,
  name: string,
): Command {
  return ['tar', '-czf', archive, '-C', folder, name]
}

/**
 * Returns the path of the one `.app` in an iOS simulator build. The first
 * call unpacks the archive into `extracted/<id>/`. It unpacks into a
 * temporary folder and renames the folder last, so each folder in
 * `extracted/` is complete.
 */
export async function unpackIosBuild(
  build: StoredBuild,
  options: UnpackOptions,
): Promise<string> {
  const folder = extractedFolder(options.home, build.id)
  const cached = await findApps(folder)
  const [cachedApp] = cached
  if (cached.length === 1 && cachedApp !== undefined) {
    return path.join(folder, cachedApp)
  }
  // Only a changed cache gets here, because a complete unpack has one .app.
  await rm(folder, { recursive: true, force: true })

  const temp = tempPath(folder)
  await mkdir(temp, { recursive: true })
  try {
    const result = await runTool(
      options.run,
      tarExtractCommand(build.path, temp),
      options.cwd,
      TAR_MISSING,
    )
    if (result.code !== 0) {
      throw new DeviceError(
        `"tar" cannot unpack the build ${build.id}, and failed with exit code ${result.code}. The stored file can be damaged. ${downloadAgainFix(build.path)}${outputTail(result.stderr)}`,
      )
    }
    const apps = await findApps(temp)
    const [app] = apps
    if (apps.length !== 1 || app === undefined) {
      throw new DeviceError(appCountProblem(build, apps))
    }
    try {
      await rename(temp, folder)
    } catch (error) {
      // A second install of the same build renamed its folder first. The two
      // folders have the same content, so DevHub uses that one.
      if (
        !isErrnoException(error) ||
        (error.code !== 'ENOTEMPTY' && error.code !== 'EEXIST')
      ) {
        throw error
      }
    }
    return path.join(folder, app)
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
}

/**
 * Returns the `.app` folders under `root`, as relative paths. It does not
 * look inside an `.app`, because an app can hold a watch app.
 */
async function findApps(root: string, relative = ''): Promise<string[]> {
  let entries
  try {
    entries = await readdir(path.join(root, relative), { withFileTypes: true })
  } catch (error) {
    if (relative === '' && isErrnoException(error) && error.code === 'ENOENT') {
      return []
    }
    throw error
  }
  const apps: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue
    }
    const child = path.join(relative, entry.name)
    if (entry.name.endsWith('.app')) {
      apps.push(child)
    } else {
      apps.push(...(await findApps(root, child)))
    }
  }
  return apps.sort()
}

function appCountProblem(build: StoredBuild, apps: string[]): string {
  if (apps.length === 0) {
    return `The archive ${build.record.file} of the build ${build.id} has no .app folder, so it is not an iOS simulator build.`
  }
  return [
    `The archive ${build.record.file} of the build ${build.id} has ${apps.length} .app folders. DevHub installs a build with exactly one .app:`,
    ...apps.map((app) => `  ${app}`),
  ].join('\n')
}
