import type { BuildList, Device, EasBuild, ListedBuild } from '../api/types'
import { formatBytes, formatDate, platformLabel, shortIds } from './format'
import { deviceLabel } from './install'

export type BuildRow = {
  id: string
  build: ListedBuild
  shortId: string
  /** For example "Android · development". */
  title: string
  /** Version, commit, and creation date. */
  details: string
  /** When EAS deletes, or deleted, its copy. Empty when EAS gives no date. */
  expiry: string
  size: string
}

export type ProjectGroup = { project: string; builds: BuildRow[] }

export function projectName(build: EasBuild): string {
  return build.app?.slug ?? build.app?.name ?? '-'
}

/** Groups the builds by project, in the order of `devhub list`. */
export function groupBuilds(list: BuildList, now: Date): ProjectGroup[] {
  const shortId = shortIds(list.builds.map((build) => build.id))
  const groups: ProjectGroup[] = []
  for (const build of list.builds) {
    const project = projectName(build.eas)
    let group = groups.find((candidate) => candidate.project === project)
    if (group === undefined) {
      group = { project, builds: [] }
      groups.push(group)
    }
    group.builds.push({
      id: build.id,
      build,
      shortId: shortId(build.id),
      title: [
        platformLabel(build.eas.platform, build.eas.isForIosSimulator),
        build.eas.buildProfile ?? '-',
      ].join(' · '),
      details: [
        `Version ${build.eas.appVersion ?? '-'}`,
        `commit ${build.eas.gitCommitHash?.slice(0, 7) ?? '-'}`,
        `created ${formatDate(build.eas.createdAt)}`,
      ].join(' · '),
      expiry: expiryText(build.eas.expirationDate, now),
      size: formatBytes(build.size),
    })
  }
  return groups
}

function expiryText(iso: string | undefined, now: Date): string {
  if (iso === undefined || Number.isNaN(Date.parse(iso))) {
    return ''
  }
  return Date.parse(iso) <= now.getTime()
    ? `EAS deleted its copy on ${formatDate(iso)}`
    : `EAS deletes its copy on ${formatDate(iso)}`
}

/** The notes of `devhub list` about build folders that it cannot show. */
export function storeNotes(list: BuildList): string[] {
  const notes: string[] = []
  const incomplete = list.incomplete.length
  if (incomplete > 0) {
    notes.push(
      incomplete === 1
        ? 'The store has 1 incomplete build folder. The next devhub sync replaces it.'
        : `The store has ${incomplete} incomplete build folders. The next devhub sync replaces them.`,
    )
  }
  for (const { id, reason } of list.unreadable) {
    notes.push(`DevHub cannot read the build ${id}. ${reason}`)
  }
  return notes
}

export type DeviceRow = {
  id: string
  /** The name, and the iOS version of a simulator. */
  title: string
  /** For example "Android emulator · emulator-5554". */
  details: string
  /** "Ready", or the state as the device tool prints it. */
  status: string
  ready: boolean
  problem?: string
}

const KIND_LABEL: Record<Device['kind'], string> = {
  emulator: 'emulator',
  physical: 'device',
  simulator: 'simulator',
}

export function deviceRow(device: Device): DeviceRow {
  const platform = device.platform === 'ios' ? 'iOS' : 'Android'
  return {
    id: device.id,
    title: deviceLabel(device),
    details: `${platform} ${KIND_LABEL[device.kind]} · ${device.id}`,
    status: device.ready ? 'Ready' : device.state,
    ready: device.ready,
    problem: device.problem,
  }
}
