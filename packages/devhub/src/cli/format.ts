const SHORT_ID_LENGTH = 8

/**
 * Returns a function that shortens each of the IDs to the same length: 8
 * characters, or more when 8 do not make each one unique. `devhub where`
 * then accepts each short ID that the output shows.
 */
export function shortIds(ids: readonly string[]): (id: string) => string {
  const unique = [...new Set(ids)]
  let length = SHORT_ID_LENGTH
  while (
    new Set(unique.map((id) => id.slice(0, length))).size < unique.length
  ) {
    length++
  }
  return (id) => id.slice(0, length)
}

export function platformLabel(
  platform: string,
  isForIosSimulator: boolean | undefined,
): string {
  if (platform === 'ANDROID') {
    return 'android'
  }
  if (platform === 'IOS') {
    return isForIosSimulator ? 'ios simulator' : 'ios device'
  }
  return platform.toLowerCase()
}

/** The date part of an ISO timestamp, in UTC. */
export function formatDate(iso: string | undefined): string {
  if (iso === undefined || Number.isNaN(Date.parse(iso))) {
    return '-'
  }
  return new Date(iso).toISOString().slice(0, 10)
}

export function formatBytes(bytes: number): string {
  const units = ['B', 'kB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit++
  }
  return unit === 0 ? `${value} B` : `${value.toFixed(1)} ${units[unit]}`
}

/** Pads each column to its widest cell. The last column gets no padding. */
export function formatTable(rows: readonly (readonly string[])[]): string[] {
  const widths: number[] = []
  for (const row of rows) {
    row.forEach((cell, index) => {
      widths[index] = Math.max(widths[index] ?? 0, cell.length)
    })
  }
  return rows.map((row) =>
    row
      .map((cell, index) =>
        index === row.length - 1 ? cell : cell.padEnd(widths[index] ?? 0),
      )
      .join('  ')
      .trimEnd(),
  )
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}
