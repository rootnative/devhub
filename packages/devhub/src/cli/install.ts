import { listAndroidDevices, resolveAdb } from '../devices/android'
import { DeviceError, type Device } from '../devices/device'
import { selectDevice } from '../devices/select'
import { installBuild, installProblem } from '../install/install'
import {
  EXIT_CODE,
  errorMessage,
  parseCommandArgs,
  usageError,
  type CliContext,
} from './context'
import { findStoredBuild } from './find'

export const INSTALL_HELP = `Usage: devhub install <id> [options]

Install a stored Android build on an emulator or a device that is ready. <id>
is the EAS build ID, or the start of it. "devhub list" shows the builds, and
"devhub devices" shows the devices. DevHub does not start a device, and does
not open the app.

Options:
  --device <id>  The adb serial of the device. Necessary when two or more
                 devices are ready.
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

  const build = await findStoredBuild(context, query)
  if (build === undefined) {
    return EXIT_CODE.failure
  }
  const problem = installProblem(build, context.platform)
  if (problem !== undefined) {
    io.err(problem)
    return EXIT_CODE.failure
  }

  const adb = resolveAdb(context)
  let device: Device
  try {
    const choice = selectDevice(
      await listAndroidDevices(context.run, adb, context.cwd),
      'android',
      parsed.values.device,
    )
    if (choice.kind === 'error') {
      if (choice.usage) {
        return usageError(io, choice.message, 'install')
      }
      io.err(choice.message)
      return EXIT_CODE.failure
    }
    device = choice.device
    io.err(`Installing the build ${build.id} on ${device.name} (${device.id}).`)
    await installBuild(build, device, {
      run: context.run,
      adb,
      cwd: context.cwd,
      platform: context.platform,
    })
  } catch (error) {
    if (!(error instanceof DeviceError)) {
      throw error
    }
    io.err(errorMessage(error))
    return EXIT_CODE.failure
  }

  io.out(
    parsed.values.json
      ? JSON.stringify({ id: build.id, path: build.path, device }, null, 2)
      : `Installed the build ${build.id} on ${device.name} (${device.id}).`,
  )
  return EXIT_CODE.ok
}
