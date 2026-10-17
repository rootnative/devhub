import type { Device, DevicePlatform } from './device'

export type DeviceChoice =
  | { kind: 'selected'; device: Device }
  /** `usage`: the fix is an option of the command, so the exit code is 2. */
  | { kind: 'error'; message: string; usage: boolean }

const TARGETS: Record<DevicePlatform, { label: string; start: string }> = {
  android: {
    label: 'Android emulator or device',
    start:
      'Start an emulator, or connect a device with USB debugging on. Then run the command again.',
  },
  ios: {
    label: 'iOS simulator',
    start: 'Boot a simulator, and then run the command again.',
  },
}

/** Finds the device with the ID `wanted`. Case does not matter. */
export function findDevice(
  devices: readonly Device[],
  wanted: string,
): Device | undefined {
  return (
    devices.find((candidate) => candidate.id === wanted) ??
    devices.find(
      (candidate) => candidate.id.toLowerCase() === wanted.toLowerCase(),
    )
  )
}

/**
 * Chooses the device for an install on `platform`. `wanted` is the
 * `--device` value: an adb serial or a simulator UDID. A device of the other
 * platform can only be the `wanted` one, and then it gives an error.
 */
export function selectDevice(
  devices: readonly Device[],
  platform: DevicePlatform,
  wanted?: string,
): DeviceChoice {
  const { label, start } = TARGETS[platform]
  if (wanted !== undefined) {
    const device = findDevice(devices, wanted)
    if (device === undefined) {
      return failure(
        `No running ${label} has the ID "${wanted}". Run devhub devices to see the devices.`,
      )
    }
    if (device.platform !== platform) {
      return failure(
        `The device ${device.id} is an ${TARGETS[device.platform].label}, but the build is for an ${label}.`,
      )
    }
    if (!device.ready) {
      return failure(
        `The device ${device.id} is not ready. ${device.problem ?? ''}`.trim(),
      )
    }
    return { kind: 'selected', device }
  }

  const own = devices.filter((device) => device.platform === platform)
  const ready = own.filter((device) => device.ready)
  const [only] = ready
  if (ready.length === 1 && only !== undefined) {
    return { kind: 'selected', device: only }
  }
  if (ready.length > 1) {
    return {
      kind: 'error',
      usage: true,
      message: [
        `${ready.length} devices are ready. Select one with --device <id>:`,
        ...deviceLines(ready, (device) => device.name),
      ].join('\n'),
    }
  }
  if (own.length > 0) {
    return failure(
      [
        `No ${label} is ready:`,
        ...deviceLines(own, (device) => device.problem ?? device.state),
      ].join('\n'),
    )
  }
  return failure(`No ${label} runs now. ${start}`)
}

function deviceLines(
  devices: readonly Device[],
  detail: (device: Device) => string,
): string[] {
  const width = Math.max(...devices.map((device) => device.id.length))
  return devices.map(
    (device) => `  ${device.id.padEnd(width)}  ${detail(device)}`,
  )
}

function failure(message: string): DeviceChoice {
  return { kind: 'error', message, usage: false }
}
