import { stat } from 'node:fs/promises'
import path from 'node:path'
import { findBuild, scanStore } from '../store/builds'
import { resolveHome } from '../store/home'
import {
  EXIT_CODE,
  errorMessage,
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

  let found
  try {
    found = findBuild((await scanStore(resolveHome(context))).builds, query)
  } catch (error) {
    io.err(errorMessage(error))
    return EXIT_CODE.failure
  }
  if (found.kind === 'none') {
    io.err(
      `The store has no build with an ID that starts with "${query}". Run devhub list to see the stored builds.`,
    )
    return EXIT_CODE.failure
  }
  if (found.kind === 'ambiguous') {
    io.err(
      [
        `The ID "${query}" matches ${found.matches.length} stored builds:`,
        ...found.matches.map((build) => `  ${build.id}`),
        'Give more characters of the ID.',
      ].join('\n'),
    )
    return EXIT_CODE.failure
  }

  const { build } = found
  try {
    await stat(build.path)
  } catch {
    io.err(
      `The record of the build ${build.id} names the file ${build.path}, but the file does not exist. Delete the folder ${path.dirname(build.path)}, and then run devhub sync in the project to download the build again.`,
    )
    return EXIT_CODE.failure
  }
  io.out(
    parsed.values.json
      ? JSON.stringify({ id: build.id, path: build.path }, null, 2)
      : build.path,
  )
  return EXIT_CODE.ok
}
