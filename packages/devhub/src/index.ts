import pkg from '../package.json' with { type: 'json' }

export const version: string = pkg.version

export {
  runCommand,
  type Command,
  type CommandOptions,
  type CommandResult,
  type CommandRunner,
} from './command/run-command'
export {
  ADB_MISSING,
  adbAvdNameCommand,
  adbDevice,
  adbDevicesCommand,
  adbInstallCommand,
  adbUninstallCommand,
  isEmulatorSerial,
  listAndroidDevices,
  parseAdbDevices,
  parseAvdName,
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
export { deviceReport, type DeviceReport } from './flow/devices'
export { findStoredBuild } from './flow/find'
export {
  installStoredBuild,
  type InstallDeps,
  type InstallRequest,
  type InstalledBuild,
} from './flow/install'
export { listBuilds, type BuildList, type ListedBuild } from './flow/list'
export type { FlowError, FlowResult } from './flow/result'
export { adbInstallFailure, type AdbInstallTarget } from './install/adb-failure'
export {
  installBuild,
  installPlatform,
  installProblem,
  type InstallOptions,
} from './install/install'
export {
  TAR_MISSING,
  tarExtractCommand,
  unpackIosBuild,
  type UnpackOptions,
} from './install/unpack'
export {
  findBuild,
  scanStore,
  type BuildRecord,
  type FindResult,
  type StoreScan,
  type StoredBuild,
} from './store/builds'
export { resolveHome, type HomeOptions } from './store/home'
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
