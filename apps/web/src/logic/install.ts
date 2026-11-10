import type { Device, ListedBuild } from '../api/types'
import { platformOf } from './summary'

export type Platform = Device['platform']

const PLATFORMS: readonly Platform[] = ['android', 'ios']

export const NO_DEVICE =
  'No device runs now. Start an emulator, or connect an Android device with USB debugging on. On macOS, you can also boot a simulator.'

/**
 * What the install button of a build does. `refused`: `devhub install`
 * refuses the build on this system. `no-device`: no device of the build's
 * platform is ready. `one`: a click installs on that device. `many`: the
 * user selects the device first.
 */
export type InstallChoice =
  | { kind: 'refused'; reason: string }
  | { kind: 'no-device' }
  | { kind: 'one'; device: Device }
  | { kind: 'many'; devices: Device[] }

/**
 * `devices` is `undefined` while the page has no device list. The server
 * never selects a device, so the page always names one.
 */
export function installChoice(
  build: ListedBuild,
  devices: readonly Device[] | undefined,
): InstallChoice {
  if (build.installProblem !== undefined) {
    return { kind: 'refused', reason: build.installProblem }
  }
  const ready = readyDevices(devices, platformOf(build))
  const [only] = ready
  if (only === undefined) {
    return { kind: 'no-device' }
  }
  return ready.length === 1
    ? { kind: 'one', device: only }
    : { kind: 'many', devices: ready }
}

function readyDevices(
  devices: readonly Device[] | undefined,
  platform: Platform,
): Device[] {
  return (devices ?? []).filter(
    (device) => device.platform === platform && device.ready,
  )
}

/** The device ID that the developer selected for each platform. */
export type ChosenTargets = Partial<Record<Platform, string>>

/** The device of each platform that Install on a row uses at once. */
export type InstallTargets = Partial<Record<Platform, Device>>

/**
 * The install target of each platform: the selected device while it is
 * ready, or else the one ready device of the platform. With two or more
 * ready devices and no selection, the platform has no target.
 */
export function installTargets(
  devices: readonly Device[] | undefined,
  chosen: ChosenTargets,
): InstallTargets {
  const targets: InstallTargets = {}
  for (const platform of PLATFORMS) {
    const ready = readyDevices(devices, platform)
    const target =
      ready.find((device) => device.id === chosen[platform]) ??
      (ready.length === 1 ? ready[0] : undefined)
    if (target !== undefined) {
      targets[platform] = target
    }
  }
  return targets
}

/**
 * The selections that stay with a new device list. A selected device that
 * stopped, or is not ready, loses its selection, so a later device with the
 * same serial does not become the target. While the page has no device
 * list, each selection stays. Returns `chosen` itself when nothing changes.
 */
export function keepChosen(
  chosen: ChosenTargets,
  devices: readonly Device[] | undefined,
): ChosenTargets {
  if (devices === undefined) {
    return chosen
  }
  const kept: ChosenTargets = {}
  let changed = false
  for (const platform of PLATFORMS) {
    const id = chosen[platform]
    if (id === undefined) {
      continue
    }
    if (readyDevices(devices, platform).some((device) => device.id === id)) {
      kept[platform] = id
    } else {
      changed = true
    }
  }
  return changed ? kept : chosen
}

/**
 * What Install on a row does: install on the target of the build's
 * platform, or else the same as `installChoice`. A build that `devhub
 * install` refuses stays refused.
 */
export function rowInstall(
  build: ListedBuild,
  targets: InstallTargets,
  devices: readonly Device[] | undefined,
): InstallChoice {
  const choice = installChoice(build, devices)
  const target = targets[platformOf(build)]
  return choice.kind === 'refused' || target === undefined
    ? choice
    : { kind: 'one', device: target }
}

export type PickerItem = {
  device: Device
  label: string
  target: boolean
  /** The state of a device that is not ready, as adb or simctl prints it. */
  state?: string
}

/**
 * The target picker of the toolbar. `targets` are in the order of the
 * platforms. Each group holds the devices of one platform.
 */
export type PickerView =
  | { kind: 'no-device'; reason: string }
  | {
      kind: 'devices'
      targets: Device[]
      groups: { platform: Platform; items: PickerItem[] }[]
      accessibilityLabel: string
    }

export function pickerView(
  devices: readonly Device[] | undefined,
  targets: InstallTargets,
): PickerView {
  if (devices === undefined || devices.length === 0) {
    return { kind: 'no-device', reason: NO_DEVICE }
  }
  const chosen = PLATFORMS.flatMap((platform) => targets[platform] ?? [])
  const groups = PLATFORMS.map((platform) => ({
    platform,
    items: devices
      .filter((device) => device.platform === platform)
      .map(
        (device): PickerItem => ({
          device,
          label: deviceLabel(device),
          target: targets[platform]?.id === device.id,
          ...(device.ready ? {} : { state: device.state }),
        }),
      ),
  })).filter((group) => group.items.length > 0)
  return {
    kind: 'devices',
    targets: chosen,
    groups,
    accessibilityLabel:
      chosen.length === 0
        ? 'Select a device for Install'
        : `Install on ${chosen.map((device) => device.name).join(' and ')}. Select a device`,
  }
}

/** The label and the tooltip of Install when it installs at once. */
export function installOnLabel(shortId: string, device: Device): string {
  return `Install the build ${shortId} on ${deviceLabel(device)}`
}

export function installedMessage(shortId: string, device: Device): string {
  return `Installed the build ${shortId} on ${deviceLabel(device)}.`
}

/** The menu label of a device: its name, and the iOS version of a simulator. */
export function deviceLabel(device: Device): string {
  return device.osVersion === undefined
    ? device.name
    : `${device.name} (iOS ${device.osVersion})`
}
