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

/** The ABIs that the device runs, best first, separated by commas. */
export function adbAbiListCommand(adb: string, serial: string): Command {
  return [adb, '-s', serial, 'shell', 'getprop', 'ro.product.cpu.abilist']
}

/** The ABIs for which Expo CLI builds, the same list as Expo CLI 57. */
export const ANDROID_ABIS: readonly string[] = [
  'armeabi-v7a',
  'arm64-v8a',
  'x86',
  'x86_64',
]

/**
 * The ABI of a debug build of `npx expo run:android` for this device: the
 * first ABI of `ro.product.cpu.abilist` that Expo CLI builds for.
 */
export function primaryAbi(abiList: string): string | undefined {
  return abiList
    .trim()
    .split(',')
    .map((abi) => abi.trim())
    .find((abi) => ANDROID_ABIS.includes(abi))
}

export function adbAvdNameCommand(adb: string, serial: string): Command {
  return [adb, '-s', serial, 'emu', 'avd', 'name']
}

/**
 * `-r` replaces the installed app. `-d` allows an older version code, so the
 * user can go back to an older build. Android allows `-d` only for a
 * debuggable app, and a dev client is debuggable.
 */
export function adbInstallCommand(
  adb: string,
  serial: string,
  apk: string,
): Command {
  return [adb, '-s', serial, 'install', '-r', '-d', apk]
}

/** DevHub only shows this command. An uninstall deletes the app data. */
export function adbUninstallCommand(
  adb: string,
  serial: string,
  appId: string,
): Command {
  return [adb, '-s', serial, 'uninstall', appId]
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

/**
 * The AVD name from `adb emu avd name`, which prints the name and then a line
 * "OK". The emulator console answers "KO: <reason>" when it fails.
 */
export function parseAvdName(stdout: string): string | undefined {
  const first = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line !== '')
  if (first === undefined || first === 'OK' || first.startsWith('KO')) {
    return undefined
  }
  return first
}

export function isEmulatorSerial(serial: string): boolean {
  return /^emulator-\d+$/.test(serial)
}

/** `avdName` replaces the model name of an emulator. */
export function adbDevice(entry: AdbEntry, avdName?: string): Device {
  const problem = adbStateProblem(entry.state)
  return {
    platform: 'android',
    kind: isEmulatorSerial(entry.serial) ? 'emulator' : 'physical',
    id: entry.serial,
    name: avdName ?? entry.fields.model?.replace(/_/g, ' ') ?? entry.serial,
    state: entry.state,
    ready: problem === undefined,
    ...(problem !== undefined && { problem }),
  }
}

/**
 * Runs `adb devices -l`, and reads the AVD name of each ready emulator.
 * Throws a `DeviceError` when adb fails.
 */
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
  const devices: Device[] = []
  for (const entry of parseAdbDevices(result.stdout)) {
    const avdName =
      entry.state === 'device' && isEmulatorSerial(entry.serial)
        ? await readAvdName(run, adb, entry.serial, cwd)
        : undefined
    devices.push(adbDevice(entry, avdName))
  }
  return devices
}

/** A name is only a label, so a failure gives `undefined`, not an error. */
async function readAvdName(
  run: CommandRunner,
  adb: string,
  serial: string,
  cwd: string,
): Promise<string | undefined> {
  try {
    const result = await run(adbAvdNameCommand(adb, serial), { cwd })
    return result.code === 0 ? parseAvdName(result.stdout) : undefined
  } catch {
    return undefined
  }
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
