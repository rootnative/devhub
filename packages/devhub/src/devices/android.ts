import { existsSync } from 'node:fs'
import path from 'node:path'
import {
  outputTail,
  type Command,
  type CommandRunner,
} from '../command/run-command'
import { DeviceError, runTool, type Device } from './device'

export type AdbOptions = {
  env: NodeJS.ProcessEnv
  platform: NodeJS.Platform
  homedir: string
}

export const ADB_MISSING =
  'DevHub cannot find adb. Install the Android SDK Platform-Tools with Android Studio, or set ANDROID_HOME to the folder of the Android SDK. Then run the command again.'

/**
 * Returns the first `platform-tools/adb` that exists in `ANDROID_HOME`,
 * `ANDROID_SDK_ROOT`, or the default SDK folder of the OS. Without one, it
 * returns `adb`, and the runner looks for it on PATH.
 */
export function resolveAdb(
  { env, platform, homedir }: AdbOptions,
  exists: (file: string) => boolean = existsSync,
): string {
  const p = platform === 'win32' ? path.win32 : path.posix
  const program = platform === 'win32' ? 'adb.exe' : 'adb'
  const sdkFolders = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT]
  if (platform === 'darwin') {
    sdkFolders.push(p.join(homedir, 'Library', 'Android', 'sdk'))
  } else if (platform === 'win32') {
    const localAppData = env.LOCALAPPDATA ?? p.join(homedir, 'AppData', 'Local')
    sdkFolders.push(p.join(localAppData, 'Android', 'Sdk'))
  } else {
    sdkFolders.push(p.join(homedir, 'Android', 'Sdk'))
  }
  for (const sdk of sdkFolders) {
    if (sdk) {
      const adb = p.join(sdk, 'platform-tools', program)
      if (exists(adb)) {
        return adb
      }
    }
  }
  return 'adb'
}

export function adbDevicesCommand(adb: string): Command {
  return [adb, 'devices', '-l']
}

export type AdbEntry = {
  serial: string
  state: string
  /** The `key:value` fields of `adb devices -l`, for example `model`. */
  fields: Record<string, string>
}

export function parseAdbDevices(stdout: string): AdbEntry[] {
  const entries: AdbEntry[] = []
  for (const line of stdout.split(/\r?\n/)) {
    const text = line.trim()
    // adb can print "* daemon not running; starting now" before the list.
    if (text === '' || text.startsWith('*') || text.startsWith('List of')) {
      continue
    }
    const match = /^(\S+)\s+(.+)$/.exec(text)
    if (match === null) {
      continue
    }
    const [, serial = '', rest = ''] = match
    // The one state with a space. A text with a URL follows it.
    if (rest.startsWith('no permissions')) {
      entries.push({ serial, state: 'no permissions', fields: {} })
      continue
    }
    const [state = '', ...tokens] = rest.split(/\s+/)
    const fields = Object.fromEntries(
      tokens
        .map((token) => /^([a-z_]+):(.*)$/.exec(token))
        .filter((field) => field !== null)
        .map(([, key = '', value = '']) => [key, value]),
    )
    entries.push({ serial, state, fields })
  }
  return entries
}

export function isEmulatorSerial(serial: string): boolean {
  return /^emulator-\d+$/.test(serial)
}

export function adbDevice(entry: AdbEntry): Device {
  const problem = adbStateProblem(entry.state)
  return {
    platform: 'android',
    kind: isEmulatorSerial(entry.serial) ? 'emulator' : 'physical',
    id: entry.serial,
    name: entry.fields.model?.replace(/_/g, ' ') ?? entry.serial,
    state: entry.state,
    ready: problem === undefined,
    ...(problem !== undefined && { problem }),
  }
}

/** Runs `adb devices -l`. Throws a `DeviceError` when adb fails. */
export async function listAndroidDevices(
  run: CommandRunner,
  adb: string,
  cwd: string,
): Promise<Device[]> {
  const command = adbDevicesCommand(adb)
  const result = await runTool(run, command, cwd, ADB_MISSING)
  if (result.code !== 0) {
    throw new DeviceError(
      `"adb devices" failed with exit code ${result.code}.${outputTail(result.stderr)}`,
    )
  }
  return parseAdbDevices(result.stdout).map(adbDevice)
}

function adbStateProblem(state: string): string | undefined {
  switch (state) {
    case 'device':
      return undefined
    case 'unauthorized':
      return 'Unlock the device, and accept the USB debugging prompt on it.'
    case 'authorizing':
      return 'adb waits for the device to accept the connection. Wait, and run the command again.'
    case 'offline':
      return 'The device does not answer adb. Connect the device again, or restart the emulator.'
    case 'no permissions':
      return 'The system does not let adb open the device. On Linux, add a udev rule for the device: https://developer.android.com/studio/run/device'
    default:
      return `The device is in the "${state}" mode. Start Android on the device.`
  }
}
