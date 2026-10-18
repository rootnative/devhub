import type { Device } from '../devices/device'
import { listDevices } from '../devices/list'
import { deviceReport } from '../flow/devices'
import {
  EXIT_CODE,
  parseCommandArgs,
  usageError,
  type CliContext,
} from './context'
import { formatTable } from './format'

export const DEVICES_HELP = `Usage: devhub devices [options]

List the Android emulators and devices that adb sees, and on macOS the iOS
simulators that run now. DevHub can install a build on a device in the state
"ready".

Options:
  --json      Print the devices as JSON.
  -h, --help  Show this help.`

const OPTIONS = {
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const

const HEADER = ['ID', 'PLATFORM', 'KIND', 'NAME', 'STATE']

export async function devicesCommand(
  argv: readonly string[],
  context: CliContext,
): Promise<number> {
  const { io } = context
  const parsed = parseCommandArgs('devices', argv, OPTIONS, io)
  if (parsed === undefined) {
    return EXIT_CODE.usage
  }
  if (parsed.values.help) {
    io.out(DEVICES_HELP)
    return EXIT_CODE.ok
  }
  if (parsed.positionals.length > 0) {
    return usageError(io, 'devhub devices takes no arguments.', 'devices')
  }

  const list = await listDevices(context)
  const report = deviceReport(list)
  const { devices, warnings } = report
  for (const warning of warnings) {
    io.err(`Warning: ${warning}`)
  }
  const exitCode =
    warnings.length === list.sources.length ? EXIT_CODE.failure : EXIT_CODE.ok

  if (parsed.values.json) {
    io.out(JSON.stringify(report, null, 2))
    return exitCode
  }
  for (const device of devices) {
    if (device.problem !== undefined) {
      io.err(`Note: the device ${device.id} is not ready. ${device.problem}`)
    }
  }
  if (devices.length > 0) {
    io.out(formatTable([HEADER, ...devices.map(deviceRow)]).join('\n'))
  } else if (exitCode === EXIT_CODE.ok) {
    const start =
      context.platform === 'darwin'
        ? 'Start an emulator or a simulator'
        : 'Start an emulator'
    io.out(
      `No device runs now. ${start}, or connect a device with USB debugging on.`,
    )
  }
  return exitCode
}

function deviceRow(device: Device): string[] {
  return [
    device.id,
    device.platform,
    device.kind,
    device.osVersion === undefined
      ? device.name
      : `${device.name} (iOS ${device.osVersion})`,
    device.ready ? 'ready' : device.state,
  ]
}
