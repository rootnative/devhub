// The four cells at the top of each page: facts about the current selection,
// from the data that the page has already. The page makes no other call.
import type { BuildList, Device, DeviceReport, DoctorCheck } from '../api/types'
import type { IconName } from '../icons'
import type { Hue } from '../theme'
import type { DoctorState } from './doctor'
import type { DateOptions } from './format'
import { formatBytes, formatDate } from './format'
import { deviceLabel } from './install'
import { setupHue } from './sidebar'
import { buildSummary, platformOf } from './summary'

export type StripCell = {
  key: string
  label: string
  value: string
  detail: string
  hue: Hue
  icon: IconName
  /** The hue of the detail when it names a problem. */
  detailHue?: Hue
}

/** The builds of one project, or of all projects. */
export function buildCells(
  list: BuildList,
  project: string | undefined,
  now: Date,
  dates: DateOptions = {},
): StripCell[] {
  const builds = list.builds
    .map((build) => ({ build, summary: buildSummary(build) }))
    .filter(
      ({ summary }) => project === undefined || summary.project === project,
    )
  const android = builds.filter(({ build }) => platformOf(build) === 'android')
  const latest = builds.reduce<(typeof builds)[number] | undefined>(
    (newest, entry) =>
      newest === undefined ||
      time(entry.summary.createdAt) > time(newest.summary.createdAt)
        ? entry
        : newest,
    undefined,
  )
  const sizes = builds.map(({ build }) => build.size)
  const expiries = builds
    .filter(({ build }) => build.source === 'eas')
    .map(({ summary }) => summary.expirationDate)
    .filter(
      (iso): iso is string =>
        iso !== undefined && !Number.isNaN(Date.parse(iso)),
    )
  const expired = expiries.filter(
    (iso) => Date.parse(iso) <= now.getTime(),
  ).length
  const next = expiries
    .filter((iso) => Date.parse(iso) > now.getTime())
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0]
  const easCount = builds.filter(({ build }) => build.source === 'eas').length
  return [
    {
      key: 'builds',
      label: 'Builds',
      value: String(builds.length),
      detail: `${android.length} Android · ${builds.length - android.length} iOS`,
      hue: 'violet',
      icon: 'builds',
    },
    {
      key: 'latest',
      label: 'Latest build',
      value:
        latest === undefined
          ? '-'
          : formatDate(latest.summary.createdAt, now, dates),
      detail:
        latest === undefined
          ? 'No builds'
          : project === undefined
            ? `${latest.summary.project} · ${latest.summary.appVersion ?? '-'}`
            : `Version ${latest.summary.appVersion ?? '-'} · commit ${latest.summary.gitCommitHash?.slice(0, 7) ?? '-'}`,
      hue: 'sky',
      icon: 'latest',
    },
    {
      key: 'size',
      label: 'Size of the builds',
      value: formatBytes(sizes.reduce((sum, size) => sum + size, 0)),
      detail:
        sizes.length === 0
          ? 'No builds'
          : `Largest: ${formatBytes(Math.max(...sizes))}`,
      hue: 'teal',
      icon: 'size',
    },
    {
      key: 'expiry',
      label: 'Next EAS expiry',
      value: next === undefined ? '-' : formatDate(next, now, dates),
      detail:
        easCount === 0
          ? 'No EAS builds'
          : expired === 0
            ? 'EAS keeps each copy'
            : `EAS deleted ${expired === 1 ? '1 copy' : `${expired} copies`}`,
      hue: expired > 0 ? 'red' : 'slate',
      icon: 'expiry',
      ...(expired > 0 ? { detailHue: 'red' as const } : {}),
    },
  ]
}

const KIND_WORDS: Record<Device['kind'], readonly [string, string]> = {
  emulator: ['emulator', 'emulators'],
  simulator: ['simulator', 'simulators'],
  physical: ['device', 'devices'],
}

export function deviceCells(report: DeviceReport): StripCell[] {
  const { devices } = report
  const ready = devices.filter((device) => device.ready).length
  const notReady = devices.filter((device) => !device.ready)
  const [first] = notReady
  return [
    {
      key: 'ready',
      label: 'Ready',
      value: `${ready} of ${devices.length}`,
      detail:
        devices.length === 0
          ? 'No device runs'
          : notReady.length === 0
            ? 'Each device is ready'
            : `${notReady.length} not ready`,
      hue: 'green',
      icon: 'status-ok',
    },
    platformCell('android', 'Android', devices),
    platformCell('ios', 'iOS', devices),
    {
      key: 'fix',
      label: 'Needs a fix',
      value: String(notReady.length),
      detail:
        first === undefined
          ? 'Nothing'
          : `${deviceLabel(first)}: ${first.state}`,
      hue: first === undefined ? 'slate' : 'red',
      icon: 'status-warn',
      ...(first === undefined ? {} : { detailHue: 'red' as const }),
    },
  ]
}

function platformCell(
  platform: Device['platform'],
  label: string,
  devices: readonly Device[],
): StripCell {
  const own = devices.filter((device) => device.platform === platform)
  const kinds = (['emulator', 'simulator', 'physical'] as const)
    .map(
      (kind) =>
        [kind, own.filter((device) => device.kind === kind).length] as const,
    )
    .filter(([, count]) => count > 0)
    .map(([kind, count]) => `${count} ${KIND_WORDS[kind][count === 1 ? 0 : 1]}`)
  return {
    key: platform,
    label,
    value: String(own.length),
    detail: kinds.length === 0 ? 'None' : kinds.join(' · '),
    hue: platform === 'android' ? 'green' : 'blue',
    icon: platform,
  }
}

export function setupCells(state: DoctorState): StripCell[] {
  const report = state.result?.kind === 'ok' ? state.result.value : undefined
  const when = state.running
    ? 'Running the checks'
    : state.checkedAt === undefined
      ? 'Not run yet'
      : `Checked at ${clock(state.checkedAt)}`
  if (report === undefined) {
    const failed = state.result?.kind === 'error' && !state.running
    return [
      {
        key: 'checks',
        label: 'Checks',
        value: '-',
        detail: failed ? 'The check did not run' : when,
        hue: 'slate',
        icon: 'setup-check',
        ...(failed ? { detailHue: 'red' as const } : {}),
      },
      emptyCell('ok', 'OK', 'status-ok'),
      emptyCell('warn', 'Warnings', 'status-warn'),
      emptyCell('fail', 'Failures', 'status-fail'),
    ]
  }
  const of = (status: DoctorCheck['status']) =>
    report.checks.filter((check) => check.status === status)
  const names = (checks: readonly DoctorCheck[]) =>
    checks.map((check) => check.label).join(', ')
  const ok = of('ok')
  const warn = of('warn')
  const fail = of('fail')
  return [
    {
      key: 'checks',
      label: 'Checks',
      value: String(report.checks.length),
      detail: when,
      hue: setupHue(state.result),
      icon: 'setup-check',
    },
    {
      key: 'ok',
      label: 'OK',
      value: String(ok.length),
      detail: ok.length === 0 ? 'None' : names(ok),
      hue: 'green',
      icon: 'status-ok',
    },
    {
      key: 'warn',
      label: 'Warnings',
      value: String(warn.length),
      detail: warn.length === 0 ? 'None' : names(warn),
      hue: warn.length === 0 ? 'slate' : 'amber',
      icon: 'status-warn',
      ...(warn.length === 0 ? {} : { detailHue: 'amber' as const }),
    },
    {
      key: 'fail',
      label: 'Failures',
      value: String(fail.length),
      detail: fail.length === 0 ? 'Nothing blocks DevHub' : names(fail),
      hue: fail.length === 0 ? 'slate' : 'red',
      icon: 'status-fail',
      ...(fail.length === 0 ? {} : { detailHue: 'red' as const }),
    },
  ]
}

function emptyCell(key: string, label: string, icon: IconName): StripCell {
  return { key, label, value: '-', detail: 'No result', hue: 'slate', icon }
}

function time(iso: string | undefined): number {
  const value = iso === undefined ? Number.NaN : Date.parse(iso)
  return Number.isNaN(value) ? 0 : value
}

/** The local time of a date, for example "14:05". */
export function clock(date: Date): string {
  const two = (value: number) => String(value).padStart(2, '0')
  return `${two(date.getHours())}:${two(date.getMinutes())}`
}
