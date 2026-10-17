import type {
  Command,
  CommandResult,
  CommandRunner,
} from '../command/run-command'
import { isErrnoException } from '../store/files'

export type DevicePlatform = 'android' | 'ios'

/** `physical`: a phone or a tablet that adb sees over USB or Wi-Fi. */
export type DeviceKind = 'emulator' | 'physical' | 'simulator'

export type Device = {
  platform: DevicePlatform
  kind: DeviceKind
  /** The adb serial, or the simulator UDID. */
  id: string
  name: string
  /** The state as the device tool prints it. */
  state: string
  /** DevHub can install a build on the device now. */
  ready: boolean
  /** Why DevHub cannot install on the device now, and the fix. */
  problem?: string
}

/** A device tool failed, or a build cannot go on a device. */
export class DeviceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DeviceError'
  }
}

/** Runs a device tool. A program that does not start gives `missing`. */
export async function runTool(
  run: CommandRunner,
  command: Command,
  cwd: string,
  missing: string,
): Promise<CommandResult> {
  try {
    return await run(command, { cwd })
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      throw new DeviceError(missing)
    }
    throw error
  }
}
