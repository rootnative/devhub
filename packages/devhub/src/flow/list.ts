import type { EasBuild } from '../eas/build'
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
}

/** The JSON of `devhub list --json`. */
export type BuildList = {
  /** Sorted by project, and then newest first. */
  builds: ListedBuild[]
  /** Build folders with no build.json. The next sync replaces them. */
  incomplete: string[]
  unreadable: UnreadableBuild[]
}

export async function listBuilds(home: string): Promise<FlowResult<BuildList>> {
  let scan: StoreScan
  try {
    scan = await scanStore(home)
  } catch (error) {
    return failure(errorMessage(error))
  }
  return {
    kind: 'ok',
    value: {
      builds: scan.builds.map(listedBuild).sort(compareBuilds),
      incomplete: scan.incomplete,
      unreadable: scan.unreadable,
    },
  }
}

export function projectName(build: EasBuild): string {
  return build.app?.slug ?? build.app?.name ?? '-'
}

function listedBuild({ id, path, record }: StoredBuild): ListedBuild {
  return {
    id,
    path,
    size: record.size,
    sha256: record.sha256,
    storedAt: record.storedAt,
    eas: record.eas,
  }
}

function compareBuilds(a: ListedBuild, b: ListedBuild): number {
  const byProject = projectName(a.eas).localeCompare(projectName(b.eas))
  if (byProject !== 0) {
    return byProject
  }
  return (b.eas.createdAt ?? '').localeCompare(a.eas.createdAt ?? '')
}
