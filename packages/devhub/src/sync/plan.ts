import { artifactUrl, isExpired, type EasBuild } from '../eas/build'
import type { SyncProfile } from '../eas/profiles'
import { isSafeBuildId } from '../store/builds'

export type PlanItem =
  | { action: 'download'; profile: string; build: EasBuild; url: string }
  | {
      action: 'stored' | 'expired' | 'no-artifact' | 'invalid-id'
      profile: string
      build: EasBuild
    }

export type PlanAction = PlanItem['action']

export type ProfileBuilds = {
  profile: SyncProfile
  builds: readonly EasBuild[]
}

/**
 * Decides what the sync does with each EAS build. A stored build stays
 * stored, even after EAS deletes it. A build for a platform that the profile
 * does not make a dev client for is not part of the plan.
 */
export function planSync({
  profileBuilds,
  storedIds,
  now,
}: {
  profileBuilds: readonly ProfileBuilds[]
  storedIds: ReadonlySet<string>
  now: Date
}): PlanItem[] {
  const seen = new Set<string>()
  const plan: PlanItem[] = []
  for (const { profile, builds } of profileBuilds) {
    const platforms = new Set<string>(profile.platforms)
    for (const build of builds) {
      if (!platforms.has(build.platform) || seen.has(build.id)) {
        continue
      }
      seen.add(build.id)
      plan.push(planItem(profile.name, build, storedIds, now))
    }
  }
  return plan
}

function planItem(
  profile: string,
  build: EasBuild,
  storedIds: ReadonlySet<string>,
  now: Date,
): PlanItem {
  if (!isSafeBuildId(build.id)) {
    return { action: 'invalid-id', profile, build }
  }
  if (storedIds.has(build.id)) {
    return { action: 'stored', profile, build }
  }
  if (isExpired(build, now)) {
    return { action: 'expired', profile, build }
  }
  const url = artifactUrl(build)
  if (url === undefined) {
    return { action: 'no-artifact', profile, build }
  }
  return { action: 'download', profile, build, url }
}
