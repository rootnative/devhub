// The same rules as the text output of the CLI, so a short ID on the page
// also works with `devhub where` and `devhub install`. Dates are the
// exception: the CLI prints ISO dates, and the page prints relative or short
// dates in the locale of the OS.

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

/**
 * The page passes none, so a date follows the locale and the time zone of
 * the OS. A test sets both.
 */
export type DateOptions = { locale?: string; timeZone?: string }

export type DateText = {
  /** For example "3 hours ago", "in 5 days", "Oct 6", or "Aug 2, 2025". */
  text: string
  /** `true` when `text` is relative to now, so a sentence needs no "on". */
  relative: boolean
  /** The date and the time, for a tooltip. */
  full: string
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const RELATIVE_DAYS = 7

/**
 * A date in the 7 days before or after `now` as relative time, and other
 * dates as a short date. The year shows only when it is not the year of
 * `now`. `undefined` when the timestamp is not valid.
 */
export function dateText(
  iso: string | undefined,
  now: Date,
  options: DateOptions = {},
): DateText | undefined {
  if (iso === undefined || Number.isNaN(Date.parse(iso))) {
    return undefined
  }
  const date = new Date(iso)
  const { locale, timeZone } = options
  const full = dateFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(date)
  const relative = relativeText(date, now, options)
  if (relative !== undefined) {
    return { text: relative, relative: true, full }
  }
  const sameYear =
    calendarDay(date, timeZone).year === calendarDay(now, timeZone).year
  const text = dateFormat(locale, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone,
  }).format(date)
  return { text, relative: false, full }
}

/** The text of `dateText`, or `-` when the timestamp is not valid. */
export function formatDate(
  iso: string | undefined,
  now: Date,
  options: DateOptions = {},
): string {
  return dateText(iso, now, options)?.text ?? '-'
}

function relativeText(
  date: Date,
  now: Date,
  { locale, timeZone }: DateOptions,
): string | undefined {
  const format = relativeFormat(locale)
  const offset = date.getTime() - now.getTime()
  const size = Math.abs(offset)
  if (size < MINUTE) {
    return format.format(0, 'second')
  }
  if (size < HOUR) {
    return format.format(Math.trunc(offset / MINUTE), 'minute')
  }
  if (size < DAY) {
    return format.format(Math.trunc(offset / HOUR), 'hour')
  }
  // Calendar days, not 24-hour periods: 30 hours before a morning is two
  // days ago, not yesterday.
  const days = calendarDay(date, timeZone).day - calendarDay(now, timeZone).day
  return Math.abs(days) < RELATIVE_DAYS ? format.format(days, 'day') : undefined
}

/** The year, and a day number that counts calendar days in the time zone. */
function calendarDay(
  date: Date,
  timeZone: string | undefined,
): { year: number; day: number } {
  const parts = dateFormat('en-US', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone,
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((candidate) => candidate.type === type)?.value)
  const year = part('year')
  return { year, day: Date.UTC(year, part('month') - 1, part('day')) / DAY }
}

// A table renders each date on each render, and a new Intl object costs much
// more than a format call.
const dateFormats = new Map<string, Intl.DateTimeFormat>()
const relativeFormats = new Map<string, Intl.RelativeTimeFormat>()

function dateFormat(
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = JSON.stringify([locale, options])
  let format = dateFormats.get(key)
  if (format === undefined) {
    format = new Intl.DateTimeFormat(locale, options)
    dateFormats.set(key, format)
  }
  return format
}

function relativeFormat(locale: string | undefined): Intl.RelativeTimeFormat {
  const key = locale ?? ''
  let format = relativeFormats.get(key)
  if (format === undefined) {
    format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    relativeFormats.set(key, format)
  }
  return format
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
