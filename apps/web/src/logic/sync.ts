// The same text as `devhub sync`, so the page and the terminal agree.
import type {
  BuildOutcome,
  BuildStatus,
  ProjectSyncResult,
  SyncReport,
} from '../api/types'
import { formatBytes, platformLabel, shortIds } from './format'

export const NO_PROJECT =
  'DevHub knows no project folders. Run devhub sync in a project folder first.'

export type SyncProjectView = {
  /** The last part of the project folder. */
  name: string
  path: string
  failed: boolean
  lines: string[]
}

export type SyncView = {
  failed: boolean
  projects: SyncProjectView[]
}

const STATUS_LABEL: Record<BuildStatus, string> = {
  downloaded: 'Downloaded',
  'would-download': 'Would download',
  stored: 'Stored',
  expired: 'Expired',
  'no-artifact': 'No file',
  'invalid-id': 'Invalid ID',
  failed: 'Failed',
}

/** Stored and expired builds appear only as a count. They repeat each day. */
const LISTED: ReadonlySet<BuildStatus> = new Set([
  'downloaded',
  'would-download',
  'no-artifact',
  'invalid-id',
  'failed',
])

export function syncView(report: SyncReport): SyncView {
  const projects = report.projects.map(projectView)
  return { failed: projects.some((project) => project.failed), projects }
}

function projectView(project: ProjectSyncResult): SyncProjectView {
  const view: SyncProjectView = {
    name: project.project.split(/[\\/]/).filter(Boolean).pop() ?? '-',
    path: project.project,
    failed:
      project.status === 'failed' ||
      project.builds.some((build) => build.status === 'failed'),
    lines: [],
  }
  if (project.status === 'missing') {
    view.lines.push('Skipped. The folder does not exist.')
    return view
  }
  const listed = project.builds.filter((build) => LISTED.has(build.status))
  const shortId = shortIds(listed.map((build) => build.id))
  for (const build of listed) {
    view.lines.push(buildLine(build, shortId(build.id)))
  }
  view.lines.push(
    project.status === 'failed'
      ? `Failed. ${project.error ?? ''}`.trimEnd()
      : summary(project.builds),
  )
  view.lines.push(...project.warnings.map((warning) => `Warning: ${warning}`))
  return view
}

function buildLine(build: BuildOutcome, shortId: string): string {
  const parts = [
    `${STATUS_LABEL[build.status]} ${shortId}`,
    platformLabel(build.platform, build.isForIosSimulator),
    build.profile,
    ...(build.size === undefined ? [] : [formatBytes(build.size)]),
  ]
  const line = parts.join(' · ')
  return build.error === undefined ? line : `${line}. ${build.error}`
}

function summary(builds: readonly BuildOutcome[]): string {
  if (builds.length === 0) {
    return 'EAS has no finished build of these profiles.'
  }
  const count = (status: BuildStatus) =>
    builds.filter((build) => build.status === status).length
  const size = builds.reduce((total, build) => total + (build.size ?? 0), 0)
  const expired = count('expired')
  const parts = [
    count('downloaded') > 0 &&
      `${count('downloaded')} downloaded (${formatBytes(size)})`,
    count('would-download') > 0 && `${count('would-download')} to download`,
    count('stored') > 0 && `${count('stored')} already stored`,
    expired > 0 &&
      `${expired} ${expired === 1 ? 'build' : 'builds'} expired before sync`,
    count('no-artifact') > 0 && `${count('no-artifact')} with no file on EAS`,
    count('invalid-id') > 0 && `${count('invalid-id')} with an invalid ID`,
    count('failed') > 0 && `${count('failed')} failed`,
  ].filter((part): part is string => typeof part === 'string')
  return `${parts.join(', ')}.`
}
