import { scanStore, type StoredBuild, type StoreScan } from '../store/builds'
import { resolveHome } from '../store/home'
import {
  EXIT_CODE,
  errorMessage,
  parseCommandArgs,
  usageError,
  type CliContext,
} from './context'
import {
  formatDate,
  formatTable,
  platformLabel,
  plural,
  projectName,
  shortIds,
} from './format'

export const LIST_HELP = `Usage: devhub list [options]

Show the builds in the store, sorted by project and then newest first.
EAS EXPIRY is the date on which EAS deletes its copy. The copy in the store
stays.

Options:
  --json      Print the builds as JSON.
  -h, --help  Show this help.`

const OPTIONS = {
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const

const HEADER = [
  'ID',
  'PROJECT',
  'PLATFORM',
  'PROFILE',
  'VERSION',
  'COMMIT',
  'CREATED',
  'EAS EXPIRY',
]

export async function listCommand(
  argv: readonly string[],
  context: CliContext,
): Promise<number> {
  const { io } = context
  const parsed = parseCommandArgs('list', argv, OPTIONS, io)
  if (parsed === undefined) {
    return EXIT_CODE.usage
  }
  if (parsed.values.help) {
    io.out(LIST_HELP)
    return EXIT_CODE.ok
  }
  if (parsed.positionals.length > 0) {
    return usageError(io, 'devhub list takes no arguments.', 'list')
  }

  let scan: StoreScan
  try {
    scan = await scanStore(resolveHome(context))
  } catch (error) {
    io.err(errorMessage(error))
    return EXIT_CODE.failure
  }
  const builds = sortBuilds(scan.builds)
  printNotes(scan, context)

  if (parsed.values.json) {
    io.out(
      JSON.stringify(
        {
          builds: builds.map((build) => ({
            id: build.id,
            path: build.path,
            size: build.record.size,
            sha256: build.record.sha256,
            storedAt: build.record.storedAt,
            eas: build.record.eas,
          })),
          incomplete: scan.incomplete,
          unreadable: scan.unreadable,
        },
        null,
        2,
      ),
    )
    return EXIT_CODE.ok
  }
  if (builds.length === 0) {
    io.out('The store has no builds. Run devhub sync in a project folder.')
    return EXIT_CODE.ok
  }
  const shortId = shortIds(builds.map((build) => build.id))
  io.out(
    formatTable([
      HEADER,
      ...builds.map((build) => buildRow(build, shortId)),
    ]).join('\n'),
  )
  return EXIT_CODE.ok
}

export function sortBuilds(builds: readonly StoredBuild[]): StoredBuild[] {
  return [...builds].sort((a, b) => {
    const byProject = projectName(a.record.eas).localeCompare(
      projectName(b.record.eas),
    )
    if (byProject !== 0) {
      return byProject
    }
    return (b.record.eas.createdAt ?? '').localeCompare(
      a.record.eas.createdAt ?? '',
    )
  })
}

function buildRow(
  { id, record: { eas } }: StoredBuild,
  shortId: (id: string) => string,
): string[] {
  return [
    shortId(id),
    projectName(eas),
    platformLabel(eas.platform, eas.isForIosSimulator),
    eas.buildProfile ?? '-',
    eas.appVersion ?? '-',
    eas.gitCommitHash?.slice(0, 7) ?? '-',
    formatDate(eas.createdAt),
    formatDate(eas.expirationDate),
  ]
}

function printNotes(scan: StoreScan, { io }: CliContext): void {
  if (scan.incomplete.length > 0) {
    io.err(
      `Note: the store has ${plural(scan.incomplete.length, 'incomplete build folder', 'incomplete build folders')}. The next devhub sync replaces ${scan.incomplete.length === 1 ? 'it' : 'them'}.`,
    )
  }
  for (const { id, reason } of scan.unreadable) {
    io.err(`Warning: DevHub cannot read the build ${id}. ${reason}`)
  }
}
