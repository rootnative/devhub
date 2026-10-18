import type { Device } from '../devices/device'
import type { DeviceList } from '../devices/list'

/** The JSON of `devhub devices --json`. */
export type DeviceReport = {
  devices: Device[]
  /** The error of each device tool that failed, with the fix. */
  warnings: string[]
}

export function deviceReport({ devices, sources }: DeviceList): DeviceReport {
  return {
    devices,
    warnings: sources.flatMap((source) =>
      source.error === undefined ? [] : [source.error],
    ),
  }
}
