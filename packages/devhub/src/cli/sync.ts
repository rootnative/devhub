import { syncBuilds } from '../flow/sync'
import {
  syncFailed,
  type BuildOutcome,
  type BuildStatus,
  type ProjectSyncResult,
  type SyncReport,
} from '../sync/sync'
import {
  EXIT_CODE,
  flowError,
  parseCommandArgs,
  usageError,
  type CliContext,
} from './context'
import {
  formatBytes,
  formatTable,
  platformLabel,
  plural,
  shortIds,
} from './format'

export const SYNC_HELP = `Usage: devhub sync [options]

Download each finished EAS dev client build of this project that the store
does not have. A build profile is a dev client profile when it has
"developmentClient": true in eas.json. DevHub runs "eas", or "npx eas-cli"
when eas is not on PATH, and uses the eas-cli login.

Options:
  --all             Sync each project folder that devhub sync saw before.
  --profile <name>  Also sync this build profile. Give it again for each
                    other profile.
  --dry-run         Show what the sync downloads. Download nothing.
  --json            Print the result as JSON.
  -h, --help        Show this help.

The store is in the data folder of the OS. Set DEVHUB_HOME to use a
different folder.`

const OPTIONS = {
  all: { type: 'boolean' },
  profile: { type: 'string', multiple: true },
  'dry-run': { type: 'boolean' },
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const

export async function syncCommand(
  argv: readonly string[],
  context: CliContext,
): Promise<number> {
  const { io } = context
  const parsed = parseCommandArgs('sync', argv, OPTIONS, io)
  if (parsed === undefined) {
    return EXIT_CODE.usage
  }
  const { values, positionals } = parsed
  if (values.help) {
    io.out(SYNC_HELP)
    return EXIT_CODE.ok
  }
  if (positionals.length > 0) {
    return usageError(io, `devhub sync takes no arguments.`, 'sync')
  }
  const result = await syncBuilds(
    {
      all: values.all ?? false,
      extraProfiles: [...new Set(values.profile ?? [])],
      dryRun: values['dry-run'] ?? false,
    },
    { ...context, progress: (text) => io.err(text) },
  )
  if (result.kind === 'error') {
    return flowError(io, result, 'sync')
  }
  const report = result.value
  if (report.projects.length === 0) {
    io.err(
      'DevHub knows no project folders. Run devhub sync in a project folder first.',
    )
  }
  for (const project of report.projects) {
    for (const warning of project.warnings) {
      io.err(`Warning: ${warning}`)
    }
  }
  printReport(report, values.json ?? false, context)
  return syncFailed(report) ? EXIT_CODE.failure : EXIT_CODE.ok
}

function printReport(
  report: SyncReport,
  json: boolean,
  { io }: CliContext,
): void {
  if (json) {
    io.out(JSON.stringify(report, null, 2))
    return
  }
  report.projects.forEach((project, index) => {
    if (index > 0) {
      io.out('')
    }
    io.out(projectText(project, report.dryRun).join('\n'))
  })
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

function projectText(project: ProjectSyncResult, dryRun: boolean): string[] {
  const lines = [project.project]
  if (project.status === 'missing') {
    lines.push('  Skipped. The folder does not exist.')
    return lines
  }
  if (project.profiles.length > 0) {
    const profiles = project.profiles.map(
      (profile) =>
        `${profile.name} (${profile.platforms
          .map((platform) => platform.toLowerCase())
          .join(', ')})`,
    )
    lines.push(`  Profiles: ${profiles.join(', ')}`)
  }
  const listed = project.builds.filter((build) => LISTED.has(build.status))
  const shortId = shortIds(listed.map((build) => build.id))
  const rows = listed.map((build) => buildRow(build, shortId))
  for (const [index, row] of formatTable(rows).entries()) {
    lines.push(`  ${row}`)
    const error = listed[index]?.error
    if (error !== undefined) {
      lines.push(`    ${error}`)
    }
  }
  if (project.status === 'failed') {
    lines.push(`  Failed. ${project.error ?? ''}`.trimEnd())
    return lines
  }
  lines.push(`  ${summary(project.builds, dryRun)}`)
  return lines
}

function buildRow(
  build: BuildOutcome,
  shortId: (id: string) => string,
): string[] {
  return [
    STATUS_LABEL[build.status],
    shortId(build.id),
    platformLabel(build.platform, build.isForIosSimulator),
    build.profile,
    build.appVersion ?? '-',
    build.size === undefined ? '' : formatBytes(build.size),
  ]
}

function summary(builds: readonly BuildOutcome[], dryRun: boolean): string {
  if (builds.length === 0) {
    return 'EAS has no finished build of these profiles.'
  }
  const count = (status: BuildStatus) =>
    builds.filter((build) => build.status === status).length
  const size = builds.reduce((total, build) => total + (build.size ?? 0), 0)
  const parts = [
    count('downloaded') > 0 &&
      `${count('downloaded')} downloaded (${formatBytes(size)})`,
    count('would-download') > 0 && `${count('would-download')} to download`,
    count('stored') > 0 && `${count('stored')} already stored`,
    count('expired') > 0 &&
      `${plural(count('expired'), 'build', 'builds')} expired before sync`,
    count('no-artifact') > 0 && `${count('no-artifact')} with no file on EAS`,
    count('invalid-id') > 0 && `${count('invalid-id')} with an invalid ID`,
    count('failed') > 0 && `${count('failed')} failed`,
  ].filter((part): part is string => typeof part === 'string')
  const text = `${parts.join(', ')}.`
  return dryRun ? `${text} Dry run: DevHub downloaded nothing.` : text
}
