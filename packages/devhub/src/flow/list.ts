import type { EasBuild } from '../eas/build'
import { listInstallProblem } from '../install/install'
import {
  isLocalRecord,
  scanStore,
  type LocalBuild,
  type StoredBuild,
  type StoreScan,
  type UnreadableBuild,
} from '../store/builds'
import { buildSummary } from '../store/summary'
import { errorMessage, failure, type FlowResult } from './result'

type ListedFields = {
  id: string
  /** The absolute path of the build file. */
  path: string
  size: number
  sha256: string
  storedAt: string
  /**
   * Why `devhub install` refuses the build on this system, with the fix.
   * The text says "this build" and names no ID: the record has `id`.
   * Absent when it can install the build.
   */
  installProblem?: string
}

/** A build that `devhub sync` downloaded from EAS. */
export type ListedEasBuild = ListedFields & { source: 'eas'; eas: EasBuild }

/** A build that `npx expo run:*` made, and the cache provider stored. */
export type ListedLocalBuild = ListedFields & {
  source: 'local'
  local: LocalBuild
}

/** A build in the JSON of `devhub list --json`. */
export type ListedBuild = ListedEasBuild | ListedLocalBuild

/** The JSON of `devhub list --json`. */
export type BuildList = {
  /** The absolute path of the store folder. */
  store: string
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
      store: home,
      builds: scan.builds
        .map((build) => listedBuild(build, platform))
        .sort(compareBuilds),
      incomplete: scan.incomplete,
      unreadable: scan.unreadable,
    },
  }
}

function listedBuild(
  build: StoredBuild,
  platform: NodeJS.Platform,
): ListedBuild {
  const { id, path, record } = build
  const problem = listInstallProblem(build, platform)
  const fields = {
    path,
    size: record.size,
    sha256: record.sha256,
    storedAt: record.storedAt,
  }
  const listed: ListedBuild = isLocalRecord(record)
    ? { id, source: 'local', ...fields, local: record.local }
    : { id, source: 'eas', ...fields, eas: record.eas }
  return problem === undefined ? listed : { ...listed, installProblem: problem }
}

/** Newest first, by the EAS creation date or the local store date. */
export function newestFirst(a: ListedBuild, b: ListedBuild): number {
  return (buildSummary(b).createdAt ?? '').localeCompare(
    buildSummary(a).createdAt ?? '',
  )
}

function compareBuilds(a: ListedBuild, b: ListedBuild): number {
  const byProject = buildSummary(a).project.localeCompare(
    buildSummary(b).project,
  )
  return byProject !== 0 ? byProject : newestFirst(a, b)
}
