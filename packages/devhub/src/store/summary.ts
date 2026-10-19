import path from 'node:path'
import type { EasBuild } from '../eas/build'
import type { LocalBuild } from './builds'

/** The values of a stored build that do not depend on its source. */
export type BuildSummary = {
  source: 'eas' | 'local'
  /** `ANDROID` or `IOS`, as EAS writes it. */
  platform: string
  isForIosSimulator: boolean
  /** The slug of the app, or the name of the project folder. */
  project: string
  /** The EAS build profile, or `local` and the variant. */
  profile: string | undefined
  appIdentifier: string | undefined
  appVersion: string | undefined
  gitCommitHash: string | undefined
  fingerprintHash: string | undefined
  /** EAS: when EAS made the build. Local: when DevHub stored it. */
  createdAt: string | undefined
  /** When EAS deletes its copy. A local build has none. */
  expirationDate: string | undefined
}

/** A `build.json` record, or a build in the JSON of `devhub list`. */
export type BuildSource = {
  storedAt: string
  eas?: EasBuild
  local?: LocalBuild
}

export function buildSummary(build: BuildSource): BuildSummary {
  const { local } = build
  if (local !== undefined) {
    return {
      source: 'local',
      platform: local.platform,
      isForIosSimulator: local.platform === 'IOS',
      project: local.slug ?? path.basename(local.project),
      profile: `local ${local.variant}`,
      appIdentifier: local.appIdentifier,
      appVersion: local.appVersion,
      gitCommitHash: local.gitCommitHash,
      fingerprintHash: local.fingerprintHash,
      createdAt: build.storedAt,
      expirationDate: undefined,
    }
  }
  const eas: Partial<EasBuild> = build.eas ?? {}
  return {
    source: 'eas',
    platform: eas.platform ?? '',
    isForIosSimulator: eas.isForIosSimulator === true,
    project: eas.app?.slug ?? eas.app?.name ?? '-',
    profile: eas.buildProfile,
    appIdentifier: eas.appIdentifier,
    appVersion: eas.appVersion,
    gitCommitHash: eas.gitCommitHash,
    fingerprintHash: eas.fingerprint?.hash,
    createdAt: eas.createdAt,
    expirationDate: eas.expirationDate,
  }
}
