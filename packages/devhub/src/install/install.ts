import type { CommandRunner } from '../command/run-command'
import {
  ADB_MISSING,
  adbInstallCommand,
  adbInstallFailure,
} from '../devices/android'
import { DeviceError, runTool, type Device } from '../devices/device'
import type { StoredBuild } from '../store/builds'

export type InstallOptions = {
  run: CommandRunner
  /** The adb program, from `resolveAdb`. */
  adb: string
  cwd: string
}

/**
 * Returns why DevHub cannot install the build, or `undefined` when it can.
 * DevHub installs only an Android `.apk` now.
 */
export function installProblem(build: StoredBuild): string | undefined {
  const { eas, file } = build.record
  if (eas.platform === 'ANDROID' && file.toLowerCase().endsWith('.apk')) {
    return undefined
  }
  return `DevHub can install only an Android .apk build now. The build ${build.id} is the file ${file}.`
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
  const problem = installProblem(build)
  if (problem !== undefined) {
    throw new DeviceError(problem)
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
  const failure = adbInstallFailure(result)
  if (failure !== undefined) {
    throw new DeviceError(failure)
  }
}
