// The same rules as the text output of the CLI, so a short ID on the page
// also works with `devhub where` and `devhub install`.

const SHORT_ID_LENGTH = 8

/** Shortens each ID to 8 characters, or more when 8 are not unique. */
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
    return 'Android'
  }
  if (platform === 'IOS') {
    return isForIosSimulator ? 'iOS simulator' : 'iOS device'
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
