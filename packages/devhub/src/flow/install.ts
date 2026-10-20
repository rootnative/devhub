import path from 'node:path'
import { listAndroidDevices, resolveAdb } from '../devices/android'
import {
  DeviceError,
  type Device,
  type DevicePlatform,
} from '../devices/device'
import { listIosSimulators } from '../devices/ios'
import type { DeviceListOptions } from '../devices/list'
import { findDevice, selectDevice } from '../devices/select'
import {
  installBuild,
  installPlatform,
  installProblem,
} from '../install/install'
import {
  downloadAgainFix,
  isLocalRecord,
  type StoredBuild,
} from '../store/builds'
import { hashFile } from '../store/files'
import { resolveHome } from '../store/home'
import { findStoredBuild } from './find'
import { errorMessage, failure, type FlowResult } from './result'

export type InstallRequest = {
  /** The EAS build ID, or a unique prefix of it. */
  id: string
  /**
   * The adb serial or the simulator UDID. Without it, DevHub uses the one
   * ready device of the build's platform.
   */
  device?: string
}

export type InstallDeps = DeviceListOptions & {
  /** Progress text for a person. The CLI writes it to stderr. */
  progress: (text: string) => void
}

/** The JSON of `devhub install --json`. */
export type InstalledBuild = {
  id: string
  /** The absolute path of the build file. */
  path: string
  device: Device
}

/**
 * Finds a stored build, checks it, selects the device, and installs the
 * build. It checks the build before it runs a device tool, and it compares
 * the SHA-256 of the file with the record before the install.
 */
export async function installStoredBuild(
  request: InstallRequest,
  deps: InstallDeps,
): Promise<FlowResult<InstalledBuild>> {
  const home = resolveHome(deps)
  const found = await findStoredBuild(home, request.id)
  if (found.kind === 'error') {
    return found
  }
  const build = found.value
  const problem = installProblem(build, deps.platform)
  if (problem !== undefined) {
    return failure(problem)
  }

  const target = installPlatform(build)
  try {
    const choice = selectDevice(
      await installDevices(deps, target, request.device),
      target,
      request.device,
    )
    if (choice.kind === 'error') {
      return choice
    }
    const { device } = choice
    const hashProblem = await hashProblemOf(build)
    if (hashProblem !== undefined) {
      return failure(hashProblem)
    }
    deps.progress(
      `Installing the build ${build.id} on ${device.name} (${device.id}).`,
    )
    await installBuild(build, device, {
      run: deps.run,
      adb: resolveAdb(deps),
      cwd: deps.cwd,
      platform: deps.platform,
      home,
    })
    return { kind: 'ok', value: { id: build.id, path: build.path, device } }
  } catch (error) {
    if (!(error instanceof DeviceError)) {
      throw error
    }
    return failure(error.message)
  }
}

/**
 * Lists the devices of the build's platform. The other device tool runs only
 * for a `--device` that is not on that list, so an iOS install does not
 * start the adb server.
 */
async function installDevices(
  deps: DeviceListOptions,
  target: DevicePlatform,
  wanted: string | undefined,
): Promise<Device[]> {
  const devices = await platformDevices(deps, target)
  const other = target === 'ios' ? 'android' : 'ios'
  if (
    wanted === undefined ||
    findDevice(devices, wanted) !== undefined ||
    (other === 'ios' && deps.platform !== 'darwin')
  ) {
    return devices
  }
  try {
    return [...devices, ...(await platformDevices(deps, other))]
  } catch (error) {
    if (!(error instanceof DeviceError)) {
      throw error
    }
    return devices
  }
}

function platformDevices(
  deps: DeviceListOptions,
  platform: DevicePlatform,
): Promise<Device[]> {
  return platform === 'ios'
    ? listIosSimulators(deps.run, deps.cwd)
    : listAndroidDevices(deps.run, resolveAdb(deps), deps.cwd)
}

/**
 * The file must have the SHA-256 that the record stores. The sync and the
 * local store write the hash of the file they store, so a different hash
 * means the file changed after that.
 */
async function hashProblemOf(build: StoredBuild): Promise<string | undefined> {
  let sha256: string
  try {
    sha256 = (await hashFile(build.path)).sha256
  } catch (error) {
    return `DevHub cannot read the file ${build.path} of the build ${build.id}: ${errorMessage(error)}`
  }
  if (sha256 === build.record.sha256) {
    return undefined
  }
  return `The file ${build.path} of the build ${build.id} has the SHA-256 ${sha256}, but its record has ${build.record.sha256}. The file changed after DevHub stored it, so DevHub does not install it. ${storeAgainFix(build)}`
}

function storeAgainFix(build: StoredBuild): string {
  if (!isLocalRecord(build.record)) {
    return downloadAgainFix(build.path)
  }
  const platform = build.record.local.platform.toLowerCase()
  return `Delete the folder ${path.dirname(build.path)}, and then run npx expo run:${platform} in the project to store the build again.`
}
