import { listAndroidDevices, resolveAdb } from '../devices/android'
import {
  DeviceError,
  type Device,
  type DevicePlatform,
} from '../devices/device'
import { listIosSimulators } from '../devices/ios'
import { findDevice, selectDevice } from '../devices/select'
import {
  installBuild,
  installPlatform,
  installProblem,
} from '../install/install'
import { resolveHome } from '../store/home'
import {
  EXIT_CODE,
  errorMessage,
  parseCommandArgs,
  usageError,
  type CliContext,
} from './context'
import { findStoredBuild } from './find'

export const INSTALL_HELP = `Usage: devhub install <id> [options]

Install a stored build on a device that is ready: an Android build on an
emulator or a device, or an iOS simulator build on a booted simulator (macOS
only). <id> is the EAS build ID, or the start of it. "devhub list" shows the
builds, and "devhub devices" shows the devices. DevHub does not start a
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

  const build = await findStoredBuild(context, query)
  if (build === undefined) {
    return EXIT_CODE.failure
  }
  const problem = installProblem(build, context.platform)
  if (problem !== undefined) {
    io.err(problem)
    return EXIT_CODE.failure
  }

  const target = installPlatform(build)
  const wanted = parsed.values.device
  let device: Device
  try {
    const choice = selectDevice(
      await installDevices(context, target, wanted),
      target,
      wanted,
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
      adb: resolveAdb(context),
      cwd: context.cwd,
      platform: context.platform,
      home: resolveHome(context),
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

/**
 * Lists the devices of the build's platform. The other device tool runs only
 * for a `--device` that is not on that list, so an iOS install does not
 * start the adb server.
 */
async function installDevices(
  context: CliContext,
  target: DevicePlatform,
  wanted: string | undefined,
): Promise<Device[]> {
  const devices = await platformDevices(context, target)
  const other = target === 'ios' ? 'android' : 'ios'
  if (
    wanted === undefined ||
    findDevice(devices, wanted) !== undefined ||
    (other === 'ios' && context.platform !== 'darwin')
  ) {
    return devices
  }
  try {
    return [...devices, ...(await platformDevices(context, other))]
  } catch (error) {
    if (!(error instanceof DeviceError)) {
      throw error
    }
    return devices
  }
}

function platformDevices(
  context: CliContext,
  platform: DevicePlatform,
): Promise<Device[]> {
  return platform === 'ios'
    ? listIosSimulators(context.run, context.cwd)
    : listAndroidDevices(context.run, resolveAdb(context), context.cwd)
}
