import { installStoredBuild } from '../flow/install'
import {
  EXIT_CODE,
  flowError,
  parseCommandArgs,
  usageError,
  type CliContext,
} from './context'

export const INSTALL_HELP = `Usage: devhub install <id> [options]

Install a stored build on a device that is ready: an Android build on an
emulator or a device, or an iOS simulator build on a booted simulator (macOS
only). <id> is the EAS build ID, or the start of it. "devhub list" shows the
builds, and "devhub devices" shows the devices. DevHub compares the SHA-256
of the file with the record before the install. DevHub does not start a
device, and does not open the app.

Options:
  --device <id>  The adb serial or the simulator UDID of the device.
                 Necessary when two or more devices are ready.
  --json         Print the build and the device as JSON.
  -h, --help     Show this help.`

const OPTIONS = {
  device: { type: 'string' },
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const

export async function installCommand(
  argv: readonly string[],
  context: CliContext,
): Promise<number> {
  const { io } = context
  const parsed = parseCommandArgs('install', argv, OPTIONS, io)
  if (parsed === undefined) {
    return EXIT_CODE.usage
  }
  if (parsed.values.help) {
    io.out(INSTALL_HELP)
    return EXIT_CODE.ok
  }
  const [query, ...extra] = parsed.positionals
  if (query === undefined || query === '') {
    return usageError(io, 'devhub install needs a build ID.', 'install')
  }
  if (extra.length > 0) {
    return usageError(io, 'devhub install takes one build ID.', 'install')
  }

  const result = await installStoredBuild(
    { id: query, device: parsed.values.device },
    { ...context, progress: (text) => io.err(text) },
  )
  if (result.kind === 'error') {
    return flowError(io, result, 'install')
  }
  const { id, device } = result.value
  io.out(
    parsed.values.json
      ? JSON.stringify(result.value, null, 2)
      : `Installed the build ${id} on ${device.name} (${device.id}).`,
  )
  return EXIT_CODE.ok
}
