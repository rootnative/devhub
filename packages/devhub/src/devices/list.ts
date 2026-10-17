import type { CommandRunner } from '../command/run-command'
import { listAndroidDevices, resolveAdb } from './android'
import { DeviceError, type Device, type DevicePlatform } from './device'

export type DeviceListOptions = {
  run: CommandRunner
  env: NodeJS.ProcessEnv
  platform: NodeJS.Platform
  homedir: string
  cwd: string
}

/** One device tool. `error` is set when the tool failed, with the fix. */
export type DeviceSource = { platform: DevicePlatform; error?: string }

export type DeviceList = {
  devices: Device[]
  sources: DeviceSource[]
}

/**
 * Lists the devices of each device tool. A tool that fails does not stop the
 * others. Its source has the error.
 */
export async function listDevices(
  options: DeviceListOptions,
): Promise<DeviceList> {
  const list: DeviceList = { devices: [], sources: [] }
  try {
    const adb = resolveAdb(options)
    list.devices.push(
      ...(await listAndroidDevices(options.run, adb, options.cwd)),
    )
    list.sources.push({ platform: 'android' })
  } catch (error) {
    if (!(error instanceof DeviceError)) {
      throw error
    }
    list.sources.push({ platform: 'android', error: error.message })
  }
  return list
}
