import {
  listBuilds,
  projectName,
  type BuildList,
  type ListedBuild,
} from '../flow/list'
import { resolveHome } from '../store/home'
import {
  EXIT_CODE,
  flowError,
  parseCommandArgs,
  usageError,
  type CliContext,
} from './context'
import {
  formatDate,
  formatTable,
  platformLabel,
  plural,
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

  const result = await listBuilds(resolveHome(context))
  if (result.kind === 'error') {
    return flowError(io, result, 'list')
  }
  const list = result.value
  printNotes(list, context)

  if (parsed.values.json) {
    io.out(JSON.stringify(list, null, 2))
    return EXIT_CODE.ok
  }
  if (list.builds.length === 0) {
    io.out('The store has no builds. Run devhub sync in a project folder.')
    return EXIT_CODE.ok
  }
  const shortId = shortIds(list.builds.map((build) => build.id))
  io.out(
    formatTable([
      HEADER,
      ...list.builds.map((build) => buildRow(build, shortId)),
    ]).join('\n'),
  )
  return EXIT_CODE.ok
}

function buildRow(
  { id, eas }: ListedBuild,
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

function printNotes(list: BuildList, { io }: CliContext): void {
  if (list.incomplete.length > 0) {
    io.err(
      `Note: the store has ${plural(list.incomplete.length, 'incomplete build folder', 'incomplete build folders')}. The next devhub sync replaces ${list.incomplete.length === 1 ? 'it' : 'them'}.`,
    )
  }
  for (const { id, reason } of list.unreadable) {
    io.err(`Warning: DevHub cannot read the build ${id}. ${reason}`)
  }
}
