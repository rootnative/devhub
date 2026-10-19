/**
 * The JSON of the devhub ui API: the same JSON as the CLI commands with
 * `--json`. Only the fields that the page reads are here.
 */

export type EasBuild = {
  id: string
  platform: string
  isForIosSimulator?: boolean
  buildProfile?: string
  appVersion?: string
  gitCommitHash?: string
  createdAt?: string
  expirationDate?: string
  app?: { slug?: string; name?: string }
}

/** A build that `npx expo run:*` made, and the cache provider stored. */
export type LocalBuild = {
  platform: string
  fingerprintHash: string
  /** The Android variant or the iOS configuration. */
  variant: string
  /** The project folder. */
  project: string
  slug?: string
  appVersion?: string
  gitCommitHash?: string
}

type ListedFields = {
  id: string
  path: string
  size: number
  storedAt: string
  /** Why `devhub install` refuses the build on this system, with the fix. */
  installProblem?: string
}

/** `devhub list --json`, one build. */
export type ListedBuild =
  | (ListedFields & { source: 'eas'; eas: EasBuild })
  | (ListedFields & { source: 'local'; local: LocalBuild })

/** `devhub list --json`. The builds are by project, and then newest first. */
export type BuildList = {
  builds: ListedBuild[]
  incomplete: string[]
  unreadable: { id: string; reason: string }[]
}

export type Device = {
  platform: 'android' | 'ios'
  kind: 'emulator' | 'physical' | 'simulator'
  id: string
  name: string
  state: string
  ready: boolean
  problem?: string
  osVersion?: string
}

/** `devhub devices --json`. */
export type DeviceReport = {
  devices: Device[]
  warnings: string[]
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
  size?: number
  error?: string
}

export type ProjectSyncResult = {
  /** The project folder. */
  project: string
  status: 'ok' | 'failed' | 'missing'
  profiles: { name: string; platforms: string[] }[]
  builds: BuildOutcome[]
  warnings: string[]
  error?: string
}

/** `devhub sync --all --json`. */
export type SyncReport = {
  dryRun: boolean
  projects: ProjectSyncResult[]
}

/** `devhub install <id> --device <id> --json`. */
export type InstalledBuild = {
  id: string
  path: string
  device: Device
}
