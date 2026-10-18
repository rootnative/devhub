import type { Device, ListedBuild } from '../api/types'

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
  const platform = build.eas.platform === 'IOS' ? 'ios' : 'android'
  const ready = (devices ?? []).filter(
    (device) => device.platform === platform && device.ready,
  )
  const [only] = ready
  if (only === undefined) {
    return { kind: 'no-device' }
  }
  return ready.length === 1
    ? { kind: 'one', device: only }
    : { kind: 'many', devices: ready }
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
