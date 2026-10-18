import { findStoredBuild } from '../flow/find'
import { resolveHome } from '../store/home'
import {
  EXIT_CODE,
  flowError,
  parseCommandArgs,
  usageError,
  type CliContext,
} from './context'

export const WHERE_HELP = `Usage: devhub where <id> [options]

Print the path of a stored build file. <id> is the EAS build ID, or the
start of it. "devhub list" shows a start of each ID that is unique.

Options:
  --json      Print the ID and the path as JSON.
  -h, --help  Show this help.`

const OPTIONS = {
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const

export async function whereCommand(
  argv: readonly string[],
  context: CliContext,
): Promise<number> {
  const { io } = context
  const parsed = parseCommandArgs('where', argv, OPTIONS, io)
  if (parsed === undefined) {
    return EXIT_CODE.usage
  }
  if (parsed.values.help) {
    io.out(WHERE_HELP)
    return EXIT_CODE.ok
  }
  const [query, ...extra] = parsed.positionals
  if (query === undefined || query === '') {
    return usageError(io, 'devhub where needs a build ID.', 'where')
  }
  if (extra.length > 0) {
    return usageError(io, 'devhub where takes one build ID.', 'where')
  }

  const found = await findStoredBuild(resolveHome(context), query)
  if (found.kind === 'error') {
    return flowError(io, found, 'where')
  }
  const build = found.value
  io.out(
    parsed.values.json
      ? JSON.stringify({ id: build.id, path: build.path }, null, 2)
      : build.path,
  )
  return EXIT_CODE.ok
}
