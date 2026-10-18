import { EasCliError } from '../eas/cli'
import { findEasProject } from '../eas/profiles'
import { resolveHome, type HomeOptions } from '../store/home'
import { StoreLockedError } from '../store/lock'
import { readProjects } from '../store/projects'
import { syncProjects, type SyncDeps, type SyncReport } from '../sync/sync'
import { errorMessage, failure, type FlowResult } from './result'

export type SyncRequest = {
  /**
   * `true`: each project folder in projects.json. `false`: the EAS project of
   * `cwd` or of a parent folder.
   */
  all: boolean
  /** Profiles in addition to the dev client profiles. */
  extraProfiles: readonly string[]
  dryRun: boolean
}

export type SyncBuildsDeps = HomeOptions & Omit<SyncDeps, 'home'>

/**
 * Finds the project folders and syncs them. With no known project, it
 * returns a report with no projects, and runs no eas command.
 */
export async function syncBuilds(
  request: SyncRequest,
  deps: SyncBuildsDeps,
): Promise<FlowResult<SyncReport>> {
  const home = resolveHome(deps)
  let projects: string[]
  try {
    if (request.all) {
      projects = await readProjects(home)
    } else {
      const project = await findEasProject(deps.cwd)
      if (project === undefined) {
        return failure(
          `${deps.cwd} and its parent folders have no eas.json. Run devhub sync in the folder of an EAS project.`,
        )
      }
      projects = [project]
    }
  } catch (error) {
    return failure(errorMessage(error))
  }
  if (projects.length === 0) {
    return { kind: 'ok', value: { dryRun: request.dryRun, projects: [] } }
  }

  try {
    const report = await syncProjects(
      {
        projects,
        extraProfiles: request.extraProfiles,
        dryRun: request.dryRun,
        cwd: deps.cwd,
      },
      {
        home,
        run: deps.run,
        download: deps.download,
        now: deps.now,
        progress: deps.progress,
      },
    )
    return { kind: 'ok', value: report }
  } catch (error) {
    if (error instanceof EasCliError || error instanceof StoreLockedError) {
      return failure(error.message)
    }
    throw error
  }
}
