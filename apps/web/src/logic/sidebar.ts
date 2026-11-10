import type { ApiResult } from '../api/client'
import type {
  BuildList,
  Device,
  DeviceReport,
  DoctorReport,
} from '../api/types'
import type { ApiState } from '../api/useApi'
import type { IconName } from '../icons'
import type { Hue } from '../theme'
import { doctorView } from './doctor'
import type { InstallTargets } from './install'
import { buildSummary } from './summary'
import { deviceRow } from './view'

/** The page of the main pane. The builds page shows the selected project. */
export type Page = 'builds' | 'devices' | 'setup'

const DEVICE_PREFIX = 'device:'

/** The value of the sidebar item of one device. */
export function deviceValue(device: Device): string {
  return DEVICE_PREFIX + device.id
}

/** The page of a sidebar item. Each device opens the Devices page. */
export function parsePage(value: string): Page {
  if (value === 'devices' || value.startsWith(DEVICE_PREFIX)) {
    return 'devices'
  }
  return value === 'setup' ? 'setup' : 'builds'
}

export type ProjectCount = { project: string; count: number }

/** Each project with its build count, in the order of `devhub list`. */
export function projectCounts(list: BuildList): ProjectCount[] {
  const counts: ProjectCount[] = []
  for (const build of list.builds) {
    const { project } = buildSummary(build)
    const entry = counts.find((candidate) => candidate.project === project)
    if (entry === undefined) {
      counts.push({ project, count: 1 })
    } else {
      entry.count += 1
    }
  }
  return counts
}

/**
 * The selected project, or `undefined` for all projects. When a sync or a
 * refresh removes the selected project, the selection goes back to all
 * projects. While the page has no build list, the selection stays.
 */
export function keepProject(
  project: string | undefined,
  list: BuildList | undefined,
): string | undefined {
  if (project === undefined || list === undefined) {
    return project
  }
  const found = projectCounts(list).some((entry) => entry.project === project)
  return found ? project : undefined
}

/** The builds that the builds page shows: one project, or all. */
export function scopeCount(
  list: BuildList,
  project: string | undefined,
): number {
  if (project === undefined) {
    return list.builds.length
  }
  return (
    projectCounts(list).find((entry) => entry.project === project)?.count ?? 0
  )
}

/**
 * What the project switcher offers: the other projects, and All projects
 * when a project is selected.
 */
export function switchChoices(
  counts: readonly ProjectCount[],
  project: string | undefined,
): { projects: ProjectCount[]; all: boolean } {
  return {
    projects: counts.filter((entry) => entry.project !== project),
    all: project !== undefined,
  }
}

/**
 * One letter for each of the first two words of the name: "shop-app" gives
 * "SA", and "notes" gives "N".
 */
export function projectInitials(project: string): string {
  const words = project
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== '')
  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

/**
 * The index of the avatar color of a project, below `tones`. The same name
 * always gets the same color.
 */
export function projectTone(project: string, tones: number): number {
  // FNV-1a. A sum of the character codes puts most names on the same color.
  let hash = 0x811c9dc5
  for (const char of project) {
    hash ^= char.codePointAt(0) ?? 0
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash % tones
}

export function buildCount(count: number): string {
  return count === 1 ? '1 build' : `${count} builds`
}

/** The screen reader label of an item with a count, which it says too. */
export function countLabel(label: string, count: number): string {
  return `${label}. ${buildCount(count)}`
}

export type SidebarDevice = {
  value: string
  label: string
  platform: Device['platform']
  ready: boolean
  /** Install on a row uses this device. */
  target: boolean
  /** The name, the state, and the target, because marks show them. */
  accessibilityLabel: string
}

export function sidebarDevices(
  devices: readonly Device[],
  targets: InstallTargets = {},
): SidebarDevice[] {
  return devices.map((device) => {
    const row = deviceRow(device)
    const target = targets[device.platform]?.id === device.id
    return {
      value: deviceValue(device),
      label: row.title,
      platform: device.platform,
      ready: row.ready,
      target,
      accessibilityLabel: `${row.title}. ${row.status}${target ? '. Install target' : ''}`,
    }
  })
}

/**
 * `true` when the Devices page has a message for the developer: a warning of
 * the device list, or an error.
 */
export function devicesWarning(state: ApiState<DeviceReport>): boolean {
  return (
    state.kind === 'error' ||
    (state.kind === 'ok' && state.value.warnings.length > 0)
  )
}

export type SetupMark = {
  icon: IconName
  /** The warnings and the failures of the last check. */
  problems: number
  accessibilityLabel: string
}

const SETUP_ICON: Record<'ok' | 'warn' | 'fail', IconName> = {
  ok: 'status-ok',
  warn: 'status-warn',
  fail: 'status-fail',
}

/** The hue of the Setup tile: the worst state of the last check. */
export function setupHue(result: ApiResult<DoctorReport> | undefined): Hue {
  if (result?.kind !== 'ok') {
    return 'slate'
  }
  return SETUP_HUE[doctorView(result.value).tone]
}

const SETUP_HUE: Record<'ok' | 'warn' | 'fail', Hue> = {
  ok: 'green',
  warn: 'amber',
  fail: 'red',
}

/** The Setup item: the result of the last check, or no result. */
export function setupMark(
  result: ApiResult<DoctorReport> | undefined,
): SetupMark {
  if (result?.kind !== 'ok') {
    return { icon: 'setup-check', problems: 0, accessibilityLabel: 'Setup' }
  }
  const view = doctorView(result.value)
  const problems = view.rows.filter((row) => row.problem).length
  return {
    icon: SETUP_ICON[view.tone],
    problems,
    accessibilityLabel:
      problems === 0
        ? 'Setup. No problems found.'
        : `Setup. ${problems === 1 ? '1 check needs' : `${problems} checks need`} a fix.`,
  }
}
