import type { ListedBuild } from '../api/types'

/**
 * The values of a build that do not depend on its source. A copy of
 * `buildSummary` in the core, which Metro cannot bundle for the web.
 */
export type BuildSummary = {
  platform: string
  isForIosSimulator: boolean
  project: string
  profile: string | undefined
  appVersion: string | undefined
  gitCommitHash: string | undefined
  fingerprintHash: string | undefined
  createdAt: string | undefined
  expirationDate: string | undefined
}

export function buildSummary(build: ListedBuild): BuildSummary {
  if (build.source === 'local') {
    const { local } = build
    return {
      platform: local.platform,
      isForIosSimulator: local.platform === 'IOS',
      project: local.slug ?? folderName(local.project),
      profile: `local ${local.variant}`,
      appVersion: local.appVersion,
      gitCommitHash: local.gitCommitHash,
      fingerprintHash: local.fingerprintHash,
      createdAt: build.storedAt,
      expirationDate: undefined,
    }
  }
  const { eas } = build
  return {
    platform: eas.platform,
    isForIosSimulator: eas.isForIosSimulator === true,
    project: eas.app?.slug ?? eas.app?.name ?? '-',
    profile: eas.buildProfile,
    appVersion: eas.appVersion,
    gitCommitHash: eas.gitCommitHash,
    fingerprintHash: eas.fingerprint?.hash,
    createdAt: eas.createdAt,
    expirationDate: eas.expirationDate,
  }
}

/** The last part of a macOS, Linux, or Windows path. */
function folderName(folder: string): string {
  return folder.split(/[\\/]/).filter(Boolean).at(-1) ?? folder
}
