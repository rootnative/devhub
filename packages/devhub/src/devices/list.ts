import type { CommandRunner } from '../command/run-command'
import { listAndroidDevices, resolveAdb } from './android'
import { DeviceError, type Device, type DevicePlatform } from './device'
import { listIosSimulators } from './ios'

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
 * Lists the devices of each device tool: adb, and on macOS also simctl. A
 * tool that fails does not stop the others. Its source has the error.
 */
export async function listDevices(
  options: DeviceListOptions,
): Promise<DeviceList> {
  const list: DeviceList = { devices: [], sources: [] }
  await addSource(list, 'android', () =>
    listAndroidDevices(options.run, resolveAdb(options), options.cwd),
  )
  if (options.platform === 'darwin') {
    await addSource(list, 'ios', () =>
      listIosSimulators(options.run, options.cwd),
    )
  }
  return list
}

async function addSource(
  list: DeviceList,
  platform: DevicePlatform,
  listSource: () => Promise<Device[]>,
): Promise<void> {
  try {
    list.devices.push(...(await listSource()))
    list.sources.push({ platform })
  } catch (error) {
    if (!(error instanceof DeviceError)) {
      throw error
    }
    list.sources.push({ platform, error: error.message })
  }
}
