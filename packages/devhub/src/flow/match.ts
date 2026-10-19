import type { EasBuild } from '../eas/build'
import {
  FingerprintError,
  projectFingerprint,
  resolveFingerprintModule,
  type FingerprintModule,
  type FingerprintPlatform,
} from '../fingerprint/fingerprint'
import { findProjectRoot } from '../fingerprint/project'
import { resolveHome, type HomeOptions } from '../store/home'
import { listBuilds, type ListedBuild } from './list'
import { failure, type FlowResult } from './result'

export type MatchRequest = {
  platforms: readonly FingerprintPlatform[]
}

export type MatchDeps = HomeOptions & {
  /** Progress text for a person. The CLI writes it to stderr. */
  progress: (text: string) => void
}

export type PlatformMatch = {
  platform: FingerprintPlatform
  /** The fingerprint of the project for this platform. */
  hash: string
  /** The stored builds with this fingerprint, newest first. */
  matches: ListedBuild[]
}

/** The JSON of `devhub match --json`. */
export type MatchReport = {
  /** The project folder: the nearest folder with a package.json. */
  project: string
  /** The `@expo/fingerprint` version of the project, when it is known. */
  fingerprintVersion?: string
  platforms: PlatformMatch[]
}

/**
 * Finds the project, calculates its fingerprint for each platform with the
 * project's own `@expo/fingerprint`, and finds the stored builds with the
 * same hash. It reads the store before the slow step.
 */
export async function matchBuilds(
  request: MatchRequest,
  deps: MatchDeps,
): Promise<FlowResult<MatchReport>> {
  const project = await findProjectRoot(deps.cwd)
  if (project === undefined) {
    return failure(
      `${deps.cwd} and its parent folders have no package.json. Run devhub match in the folder of an Expo project.`,
    )
  }
  const list = await listBuilds(resolveHome(deps), deps.platform)
  if (list.kind === 'error') {
    return list
  }
  let module: FingerprintModule
  try {
    module = resolveFingerprintModule(project)
  } catch (error) {
    return fingerprintFailure(error)
  }

  const platforms: PlatformMatch[] = []
  for (const platform of request.platforms) {
    deps.progress(`Calculating the ${platform} fingerprint of ${project}.`)
    let hash: string
    try {
      hash = await projectFingerprint(project, platform, module)
    } catch (error) {
      return fingerprintFailure(error)
    }
    platforms.push({
      platform,
      hash,
      matches: list.value.builds
        .filter((build) => matchesFingerprint(build.eas, platform, hash))
        .sort(newestFirst),
    })
  }
  return {
    kind: 'ok',
    value: {
      project,
      ...(module.version === undefined
        ? {}
        : { fingerprintVersion: module.version }),
      platforms,
    },
  }
}

/** A build matches when its platform and its EAS fingerprint are the same. */
export function matchesFingerprint(
  eas: EasBuild,
  platform: FingerprintPlatform,
  hash: string,
): boolean {
  return (
    eas.platform === platform.toUpperCase() && eas.fingerprint?.hash === hash
  )
}

export function hasMatch(report: MatchReport): boolean {
  return report.platforms.some((platform) => platform.matches.length > 0)
}

function newestFirst(a: ListedBuild, b: ListedBuild): number {
  return (b.eas.createdAt ?? '').localeCompare(a.eas.createdAt ?? '')
}

function fingerprintFailure(error: unknown): FlowResult<never> {
  if (error instanceof FingerprintError) {
    return failure(error.message)
  }
  throw error
}
