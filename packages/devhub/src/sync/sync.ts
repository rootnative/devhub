import { rm, stat } from 'node:fs/promises'
import path from 'node:path'
import type { CommandRunner } from '../command/run-command'
import {
  checkEasLogin,
  listFinishedBuilds,
  type EasInvocation,
} from '../eas/cli'
import {
  devClientProfiles,
  readEasJson,
  withExtraProfiles,
  type SyncProfile,
} from '../eas/profiles'
import {
  EAS_RECORD_SCHEMA_VERSION,
  prepareBuildFolder,
  storedBuildIds,
  writeBuildRecord,
} from '../store/builds'
import { acquireSyncLock } from '../store/lock'
import { addProject } from '../store/projects'
import { artifactFileName, type Downloader } from './download'
import { planSync, type PlanItem, type ProfileBuilds } from './plan'

export type SyncDeps = {
  home: string
  run: CommandRunner
  download: Downloader
  now: () => Date
  /** Progress text for a person. The CLI writes it to stderr. */
  progress: (text: string) => void
}

export type SyncOptions = {
  projects: readonly string[]
  /** Profiles from `--profile`, in addition to the dev client profiles. */
  extraProfiles: readonly string[]
  dryRun: boolean
  /** The folder in which `eas whoami` runs. */
  cwd: string
}

export type BuildStatus =
  | 'downloaded'
  | 'would-download'
  | 'stored'
  | 'expired'
  | 'no-artifact'
  | 'invalid-id'
  | 'failed'

export type BuildOutcome = {
  id: string
  status: BuildStatus
  profile: string
  platform: string
  isForIosSimulator?: boolean
  appVersion?: string
  expirationDate?: string
  /** Set when the status is `downloaded`. */
  path?: string
  size?: number
  /** Set when the status is `failed`. */
  error?: string
}

export type ProjectSyncResult = {
  project: string
  /** `missing`: the project folder does not exist. DevHub skipped it. */
  status: 'ok' | 'failed' | 'missing'
  profiles: SyncProfile[]
  builds: BuildOutcome[]
  warnings: string[]
  error?: string
}

export type SyncReport = {
  dryRun: boolean
  projects: ProjectSyncResult[]
}

/**
 * Syncs each project folder in turn. A project that fails does not stop the
 * others. The function throws only when no project can sync: `eas` is
 * missing or has no login, or another sync holds the lock.
 */
export async function syncProjects(
  options: SyncOptions,
  deps: SyncDeps,
): Promise<SyncReport> {
  const eas = await checkEasLogin(deps.run, options.cwd)
  const lock = options.dryRun ? undefined : await acquireSyncLock(deps.home)
  try {
    const projects: ProjectSyncResult[] = []
    for (const project of options.projects) {
      projects.push(await syncProject(project, eas, options, deps))
    }
    return { dryRun: options.dryRun, projects }
  } finally {
    await lock?.release()
  }
}

export function syncFailed(report: SyncReport): boolean {
  return report.projects.some(
    (project) =>
      project.status === 'failed' ||
      project.builds.some((build) => build.status === 'failed'),
  )
}

async function syncProject(
  project: string,
  eas: EasInvocation,
  options: SyncOptions,
  deps: SyncDeps,
): Promise<ProjectSyncResult> {
  const result: ProjectSyncResult = {
    project,
    status: 'ok',
    profiles: [],
    builds: [],
    warnings: [],
  }
  if (!(await isDirectory(project))) {
    result.status = 'missing'
    result.warnings.push(
      `The project folder ${project} does not exist. DevHub skips it.`,
    )
    return result
  }
  try {
    const found = devClientProfiles(await readEasJson(project))
    result.warnings.push(...found.warnings)
    result.profiles = withExtraProfiles(found.profiles, options.extraProfiles)
    if (result.profiles.length === 0) {
      throw new Error(
        `eas.json in ${project} has no build profile with "developmentClient": true. Add one, or give a profile with --profile <name>.`,
      )
    }
    if (!options.dryRun) {
      await addProject(deps.home, project)
    }
    const profileBuilds: ProfileBuilds[] = []
    for (const profile of result.profiles) {
      deps.progress(`Reading the EAS builds of the profile "${profile.name}".`)
      const builds = await listFinishedBuilds(
        deps.run,
        project,
        profile.name,
        eas,
      )
      profileBuilds.push({ profile, builds })
    }
    const plan = planSync({
      profileBuilds,
      storedIds: await storedBuildIds(deps.home),
      now: deps.now(),
    })
    for (const item of plan) {
      result.builds.push(await carryOut(item, options.dryRun, deps))
    }
  } catch (error) {
    result.status = 'failed'
    result.error = errorMessage(error)
  }
  return result
}

async function carryOut(
  item: PlanItem,
  dryRun: boolean,
  deps: SyncDeps,
): Promise<BuildOutcome> {
  const { build } = item
  const outcome: BuildOutcome = {
    id: build.id,
    status: 'failed',
    profile: item.profile,
    platform: build.platform,
    ...(build.isForIosSimulator !== undefined && {
      isForIosSimulator: build.isForIosSimulator,
    }),
    ...(build.appVersion !== undefined && { appVersion: build.appVersion }),
    ...(build.expirationDate !== undefined && {
      expirationDate: build.expirationDate,
    }),
  }
  if (item.action !== 'download') {
    return { ...outcome, status: item.action }
  }
  if (dryRun) {
    return { ...outcome, status: 'would-download' }
  }
  deps.progress(`Downloading the build ${build.id}.`)
  let folder: string | undefined
  try {
    folder = await prepareBuildFolder(deps.home, build.id)
    const file = artifactFileName(build, item.url)
    const target = path.join(folder, file)
    const { size, sha256 } = await deps.download(item.url, target)
    await writeBuildRecord(folder, {
      schemaVersion: EAS_RECORD_SCHEMA_VERSION,
      storedAt: deps.now().toISOString(),
      file,
      size,
      sha256,
      eas: build,
    })
    return { ...outcome, status: 'downloaded', path: target, size }
  } catch (error) {
    // Only a folder that this sync made. Never a folder with a record.
    if (folder !== undefined) {
      await rm(folder, { recursive: true, force: true })
    }
    return { ...outcome, error: errorMessage(error) }
  }
}

async function isDirectory(folder: string): Promise<boolean> {
  try {
    return (await stat(folder)).isDirectory()
  } catch {
    return false
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
