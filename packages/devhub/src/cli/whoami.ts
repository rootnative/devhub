import { canSync, whoami } from '../flow/whoami'
import {
  EXIT_CODE,
  parseCommandArgs,
  usageError,
  type CliContext,
} from './context'

export const WHOAMI_HELP = `Usage: devhub whoami [options]

Show the EAS login state. DevHub runs "eas whoami" with eas on PATH, or
else with "npx --yes eas-cli". A sync needs a login. The exit code is 0
with a login, and 1 without one.

Options:
  --json      Print the state as JSON.
  -h, --help  Show this help.`

const OPTIONS = {
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const

export async function whoamiCommand(
  argv: readonly string[],
  context: CliContext,
): Promise<number> {
  const { io } = context
  const parsed = parseCommandArgs('whoami', argv, OPTIONS, io)
  if (parsed === undefined) {
    return EXIT_CODE.usage
  }
  if (parsed.values.help) {
    io.out(WHOAMI_HELP)
    return EXIT_CODE.ok
  }
  if (parsed.positionals.length > 0) {
    return usageError(io, 'devhub whoami takes no arguments.', 'whoami')
  }

  const report = await whoami({ run: context.run, cwd: context.cwd })
  const exitCode = canSync(report) ? EXIT_CODE.ok : EXIT_CODE.failure
  if (parsed.values.json) {
    io.out(JSON.stringify(report, null, 2))
    return exitCode
  }
  if (report.state === 'signed-in') {
    const who = report.user === undefined ? '' : ` as ${report.user}`
    const how = report.cli === 'eas' ? 'eas on PATH' : 'npx --yes eas-cli'
    io.out(`Signed in to EAS${who} (${how}).`)
    return exitCode
  }
  io.err(report.message ?? 'eas-cli gave no answer.')
  return exitCode
}
