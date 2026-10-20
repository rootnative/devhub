import { version } from '../index'
import {
  doctor,
  doctorPassed,
  type DoctorCheck,
  type DoctorReport,
} from '../flow/doctor'
import {
  EXIT_CODE,
  parseCommandArgs,
  usageError,
  type CliContext,
} from './context'
import { formatTable, plural } from './format'

export const DOCTOR_HELP = `Usage: devhub doctor [options]

Check the tools and the store that DevHub uses on this machine: Node, the
store folder, eas-cli and its login, adb, and on macOS Xcode. Give the fix
for each problem. The checks do not read the current folder.

A warning stops one feature, for example the iOS installs. A failure stops
DevHub. The exit code is 1 when a check fails, and 0 otherwise. The first
run of "npx --yes eas-cli" downloads eas-cli, so it can take a while.

Options:
  --json      Print the report as JSON.
  -h, --help  Show this help.`

const OPTIONS = {
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const

export async function doctorCommand(
  argv: readonly string[],
  context: CliContext,
): Promise<number> {
  const { io } = context
  const parsed = parseCommandArgs('doctor', argv, OPTIONS, io)
  if (parsed === undefined) {
    return EXIT_CODE.usage
  }
  if (parsed.values.help) {
    io.out(DOCTOR_HELP)
    return EXIT_CODE.ok
  }
  if (parsed.positionals.length > 0) {
    return usageError(io, 'devhub doctor takes no arguments.', 'doctor')
  }

  const report = await doctor(context)
  const exitCode = doctorPassed(report) ? EXIT_CODE.ok : EXIT_CODE.failure
  if (parsed.values.json) {
    io.out(JSON.stringify(report, null, 2))
    return exitCode
  }
  io.out(formatReport(report).join('\n'))
  return exitCode
}

/** One row for each check, and the fix on the lines below its row. */
export function formatReport(report: DoctorReport): string[] {
  const rows = report.checks.map((check) => [
    check.status,
    check.label,
    check.detail,
  ])
  const table = formatTable(rows)
  const indent = ' '.repeat(
    Math.max(...rows.map((row) => row[0]?.length ?? 0)) +
      2 +
      Math.max(...rows.map((row) => row[1]?.length ?? 0)) +
      2,
  )
  const lines = [`DevHub ${version}`, '']
  report.checks.forEach((check, index) => {
    lines.push(table[index] ?? '')
    if (check.fix !== undefined) {
      for (const line of check.fix.split('\n')) {
        lines.push(`${indent}${line}`)
      }
    }
  })
  lines.push('', summary(report.checks))
  return lines
}

function summary(checks: readonly DoctorCheck[]): string {
  const failures = checks.filter((check) => check.status === 'fail').length
  const warnings = checks.filter((check) => check.status === 'warn').length
  if (failures > 0) {
    return `${plural(failures, 'check failed', 'checks failed')}. DevHub cannot work until you do the fix above.`
  }
  if (warnings > 0) {
    return `${plural(warnings, 'warning', 'warnings')}. The other features work. Do the fix above for the features that you use.`
  }
  return 'No problems found.'
}
