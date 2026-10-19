import pkg from '../package.json' with { type: 'json' }

export const version: string = pkg.version

export { apkAbis } from './binary/apk'
export {
  createCacheProvider,
  type CacheProvider,
  type CacheProviderDeps,
  type CalculateFingerprintHashProps,
  type ResolveBuildCacheProps,
  type UploadBuildCacheProps,
} from './cache-provider/provider'
export type { RunOptions } from './cache-provider/key'
export {
  runCommand,
  type Command,
  type CommandOptions,
  type CommandResult,
  type CommandRunner,
} from './command/run-command'
export {
  ADB_MISSING,
  ANDROID_ABIS,
  adbAbiListCommand,
  adbAvdNameCommand,
  adbDevice,
  adbDevicesCommand,
  adbInstallCommand,
  adbUninstallCommand,
  isEmulatorSerial,
  listAndroidDevices,
  parseAdbDevices,
  parseAvdName,
  primaryAbi,
  resolveAdb,
  type AdbEntry,
  type AdbOptions,
} from './devices/android'
export {
  DeviceError,
  type Device,
  type DeviceKind,
  type DevicePlatform,
} from './devices/device'
export {
  XCRUN_MISSING,
  iosRuntimeVersion,
  listIosSimulators,
  parseSimctlDevices,
  simctlInstallCommand,
  simctlListCommand,
} from './devices/ios'
export {
  listDevices,
  type DeviceList,
  type DeviceListOptions,
  type DeviceSource,
} from './devices/list'
export { findDevice, selectDevice, type DeviceChoice } from './devices/select'
export {
  artifactUrl,
  isExpired,
  type EasBuild,
  type EasPlatform,
} from './eas/build'
export {
  BUILD_LIST_PAGE_SIZE,
  EAS_ON_PATH,
  EAS_WITH_NPX,
  EasCliError,
  checkEasLogin,
  easBuildListCommand,
  easWhoamiCommand,
  listFinishedBuilds,
  type EasInvocation,
} from './eas/cli'
export {
  EasJsonError,
  devClientProfiles,
  findEasProject,
  parseEasJson,
  readEasJson,
  withExtraProfiles,
  type SyncProfile,
} from './eas/profiles'
export {
  FINGERPRINT_PLATFORMS,
  FingerprintError,
  projectFingerprint,
  resolveFingerprintModule,
  type FingerprintModule,
  type FingerprintPlatform,
} from './fingerprint/fingerprint'
export { findProjectRoot } from './fingerprint/project'
export { deviceReport, type DeviceReport } from './flow/devices'
export { findStoredBuild } from './flow/find'
export {
  installStoredBuild,
  type InstallDeps,
  type InstallRequest,
  type InstalledBuild,
} from './flow/install'
export {
  listBuilds,
  type BuildList,
  type ListedBuild,
  type ListedEasBuild,
  type ListedLocalBuild,
} from './flow/list'
export {
  hasMatch,
  matchBuilds,
  matchesFingerprint,
  type MatchDeps,
  type MatchReport,
  type MatchRequest,
  type PlatformMatch,
} from './flow/match'
export type { FlowError, FlowResult } from './flow/result'
export { syncBuilds, type SyncBuildsDeps, type SyncRequest } from './flow/sync'
export { adbInstallFailure, type AdbInstallTarget } from './install/adb-failure'
export {
  installBuild,
  installPlatform,
  installProblem,
  type InstallOptions,
} from './install/install'
export {
  TAR_MISSING,
  tarCreateCommand,
  tarExtractCommand,
  unpackIosBuild,
  type UnpackOptions,
} from './install/unpack'
export {
  TAR_PACK_MISSING,
  storeLocalBuild,
  type LocalBuildInput,
  type StoreLocalOptions,
} from './local/store-local'
export {
  findBuild,
  isLocalRecord,
  scanStore,
  type BuildRecord,
  type EasBuildRecord,
  type FindResult,
  type LocalBuild,
  type LocalBuildRecord,
  type StoreScan,
  type StoredBuild,
} from './store/builds'
export { resolveHome, type HomeOptions } from './store/home'
export {
  buildSummary,
  type BuildSource,
  type BuildSummary,
} from './store/summary'
export { StoreLockedError } from './store/lock'
export { readProjects } from './store/projects'
export {
  downloadFile,
  type DownloadResult,
  type Downloader,
} from './sync/download'
export { planSync, type PlanItem, type ProfileBuilds } from './sync/plan'
export {
  syncFailed,
  syncProjects,
  type BuildOutcome,
  type BuildStatus,
  type ProjectSyncResult,
  type SyncDeps,
  type SyncOptions,
  type SyncReport,
} from './sync/sync'
