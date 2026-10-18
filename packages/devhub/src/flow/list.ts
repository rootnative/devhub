import type { EasBuild } from '../eas/build'
import { installProblem } from '../install/install'
import {
  scanStore,
  type StoredBuild,
  type StoreScan,
  type UnreadableBuild,
} from '../store/builds'
import { errorMessage, failure, type FlowResult } from './result'

/** A build in the JSON of `devhub list --json`. */
export type ListedBuild = {
  id: string
  /** The absolute path of the build file. */
  path: string
  size: number
  sha256: string
  storedAt: string
  eas: EasBuild
  /**
   * Why `devhub install` refuses the build on this system, with the fix.
   * Absent when it can install the build.
   */
  installProblem?: string
}

/** The JSON of `devhub list --json`. */
export type BuildList = {
  /** Sorted by project, and then newest first. */
  builds: ListedBuild[]
  /** Build folders with no build.json. The next sync replaces them. */
  incomplete: string[]
  unreadable: UnreadableBuild[]
}

/** `platform`: the system that would run `devhub install`. */
export async function listBuilds(
  home: string,
  platform: NodeJS.Platform,
): Promise<FlowResult<BuildList>> {
  let scan: StoreScan
  try {
    scan = await scanStore(home)
  } catch (error) {
    return failure(errorMessage(error))
  }
  return {
    kind: 'ok',
    value: {
      builds: scan.builds
        .map((build) => listedBuild(build, platform))
        .sort(compareBuilds),
      incomplete: scan.incomplete,
      unreadable: scan.unreadable,
    },
  }
}

export function projectName(build: EasBuild): string {
  return build.app?.slug ?? build.app?.name ?? '-'
}

function listedBuild(
  build: StoredBuild,
  platform: NodeJS.Platform,
): ListedBuild {
  const { id, path, record } = build
  const problem = installProblem(build, platform)
  return {
    id,
    path,
    size: record.size,
    sha256: record.sha256,
    storedAt: record.storedAt,
    eas: record.eas,
    ...(problem === undefined ? {} : { installProblem: problem }),
  }
}

function compareBuilds(a: ListedBuild, b: ListedBuild): number {
  const byProject = projectName(a.eas).localeCompare(projectName(b.eas))
  if (byProject !== 0) {
    return byProject
  }
  return (b.eas.createdAt ?? '').localeCompare(a.eas.createdAt ?? '')
}
