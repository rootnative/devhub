import {
  outputTail,
  type Command,
  type CommandRunner,
} from '../command/run-command'
import { isRecord } from '../store/files'
import { DeviceError, runTool, type Device } from './device'

export const XCRUN_MISSING =
  'DevHub cannot find xcrun. Install Xcode from the App Store, and then run the command again.'

export function simctlListCommand(): Command {
  return ['xcrun', 'simctl', 'list', 'devices', '--json']
}

/** Returns the booted iOS simulators. tvOS, watchOS, and visionOS are out. */
export function parseSimctlDevices(stdout: string): Device[] {
  let value: unknown
  try {
    value = JSON.parse(stdout)
  } catch {
    throw unreadableList()
  }
  if (!isRecord(value) || !isRecord(value.devices)) {
    throw unreadableList()
  }
  const devices: Device[] = []
  for (const [runtime, simulators] of Object.entries(value.devices)) {
    const osVersion = iosRuntimeVersion(runtime)
    if (osVersion === undefined || !Array.isArray(simulators)) {
      continue
    }
    for (const simulator of simulators) {
      if (
        !isRecord(simulator) ||
        typeof simulator.udid !== 'string' ||
        typeof simulator.name !== 'string' ||
        simulator.state !== 'Booted' ||
        simulator.isAvailable === false
      ) {
        continue
      }
      devices.push({
        platform: 'ios',
        kind: 'simulator',
        id: simulator.udid,
        name: simulator.name,
        state: simulator.state,
        ready: true,
        osVersion,
      })
    }
  }
  return devices
}

/**
 * `com.apple.CoreSimulator.SimRuntime.iOS-18-6` is iOS 18.6. Xcode 10 and
 * earlier use the key `iOS 12.1`.
 */
export function iosRuntimeVersion(runtime: string): string | undefined {
  const match =
    /SimRuntime\.iOS-(\d+(?:-\d+)*)$/.exec(runtime) ??
    /^iOS (\d+(?:\.\d+)*)$/.exec(runtime)
  return match?.[1]?.replace(/-/g, '.')
}

/** Runs `xcrun simctl list`. Throws a `DeviceError` when it fails. */
export async function listIosSimulators(
  run: CommandRunner,
  cwd: string,
): Promise<Device[]> {
  const result = await runTool(run, simctlListCommand(), cwd, XCRUN_MISSING)
  if (result.code !== 0) {
    throw new DeviceError(
      `"xcrun simctl list" failed with exit code ${result.code}. Install Xcode, and select it with "sudo xcode-select --switch /Applications/Xcode.app".${outputTail(result.stderr)}`,
    )
  }
  return parseSimctlDevices(result.stdout)
}

function unreadableList(): DeviceError {
  return new DeviceError(
    '"xcrun simctl list" printed output that DevHub cannot read. Update Xcode, and then run the command again.',
  )
}
