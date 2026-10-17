import { outputTail, type CommandRunner } from '../command/run-command'
import { ADB_MISSING, adbInstallCommand } from '../devices/android'
import {
  DeviceError,
  runTool,
  type Device,
  type DevicePlatform,
} from '../devices/device'
import { XCRUN_MISSING, simctlInstallCommand } from '../devices/ios'
import type { StoredBuild } from '../store/builds'
import { adbInstallFailure } from './adb-failure'
import { unpackIosBuild } from './unpack'

export type InstallOptions = {
  run: CommandRunner
  /** The adb program, from `resolveAdb`. */
  adb: string
  cwd: string
  /** The system that DevHub runs on. */
  platform: NodeJS.Platform
  /** The DevHub home, from `resolveHome`. An iOS build unpacks into it. */
  home: string
}

/**
 * Returns why DevHub cannot install the build on this system, with the fix,
 * or `undefined` when it can: for an Android `.apk`, and on macOS for an iOS
 * simulator build.
 */
export function installProblem(
  build: StoredBuild,
  platform: NodeJS.Platform,
): string | undefined {
  const { eas, file } = build.record
  const name = file.toLowerCase()
  if (eas.platform === 'ANDROID') {
    if (name.endsWith('.apk')) {
      return undefined
    }
    if (name.endsWith('.aab')) {
      return `The build ${build.id} is an Android App Bundle (${file}). adb installs only an APK. ${profileFix(build, '"android": { "buildType": "apk" }')}`
    }
  }
  if (eas.platform === 'IOS') {
    if (platform !== 'darwin') {
      return `The build ${build.id} is an iOS build. iOS simulators run only on macOS, so DevHub installs an iOS build only on macOS.`
    }
    if (name.endsWith('.ipa')) {
      return `The build ${build.id} is an iOS device build (${file}). A simulator cannot run it. ${profileFix(build, '"ios": { "simulator": true }')}`
    }
    if (eas.isForIosSimulator === true || name.endsWith('.tar.gz')) {
      return undefined
    }
  }
  return `DevHub cannot install the build ${build.id}. Its file ${file} is not an Android .apk or an iOS simulator build.`
}

/** The device platform of a build that `installProblem` accepts. */
export function installPlatform(build: StoredBuild): DevicePlatform {
  return build.record.eas.platform === 'IOS' ? 'ios' : 'android'
}

function profileFix(build: StoredBuild, setting: string): string {
  const profile = build.record.eas.buildProfile
  const target =
    profile === undefined
      ? 'the build profile'
      : `the build profile "${profile}"`
  return `Set ${setting} in ${target} in eas.json, and make a new build.`
}

/**
 * Installs a stored build on a ready device. Throws a `DeviceError` when the
 * build or the device does not fit, or when the install fails.
 */
export async function installBuild(
  build: StoredBuild,
  device: Device,
  options: InstallOptions,
): Promise<void> {
  const problem = installProblem(build, options.platform)
  if (problem !== undefined) {
    throw new DeviceError(problem)
  }
  if (installPlatform(build) === 'ios') {
    await installIosBuild(build, device, options)
    return
  }
  if (device.platform !== 'android' || !device.ready) {
    throw new DeviceError(
      `The device ${device.id} is not a ready Android device.`,
    )
  }
  const result = await runTool(
    options.run,
    adbInstallCommand(options.adb, device.id, build.path),
    options.cwd,
    ADB_MISSING,
  )
  const failure = adbInstallFailure(result, {
    adb: options.adb,
    serial: device.id,
    apk: build.path,
    appId: build.record.eas.appIdentifier,
  })
  if (failure !== undefined) {
    throw new DeviceError(failure)
  }
}

async function installIosBuild(
  build: StoredBuild,
  device: Device,
  options: InstallOptions,
): Promise<void> {
  if (device.platform !== 'ios' || !device.ready) {
    throw new DeviceError(
      `The device ${device.id} is not a booted iOS simulator.`,
    )
  }
  const app = await unpackIosBuild(build, options)
  const result = await runTool(
    options.run,
    simctlInstallCommand(device.id, app),
    options.cwd,
    XCRUN_MISSING,
  )
  if (result.code !== 0) {
    throw new DeviceError(
      `"xcrun simctl install" failed with exit code ${result.code}.${outputTail(result.stderr)}`,
    )
  }
}
