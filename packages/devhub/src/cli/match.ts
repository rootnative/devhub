import {
  FINGERPRINT_PLATFORMS,
  type FingerprintPlatform,
} from '../fingerprint/fingerprint'
import { hasMatch, matchBuilds, type MatchReport } from '../flow/match'
import {
  EXIT_CODE,
  flowError,
  parseCommandArgs,
  usageError,
  type CliContext,
} from './context'
import { formatDate, formatTable, platformLabel, shortIds } from './format'

export const MATCH_HELP = `Usage: devhub match [options]

Find the stored builds that match the native code of the project in the
current folder. DevHub runs the @expo/fingerprint of the project, with the
same options as eas-cli, and compares the hash with the EAS fingerprint of
each stored build. A build that matches needs no new build: install it with
"devhub install <id>".

Options:
  --platform <name>  Only this platform: android or ios. Give it again for
                     the other one. The default is both.
  --json             Print the result as JSON.
  -h, --help         Show this help.

The exit code is 1 when no stored build matches.`

const OPTIONS = {
  platform: { type: 'string', multiple: true },
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const

const HEADER = [
  'ID',
  'PLATFORM',
  'PROFILE',
  'VERSION',
  'COMMIT',
  'CREATED',
  'EAS EXPIRY',
]

export async function matchCommand(
  argv: readonly string[],
  context: CliContext,
): Promise<number> {
  const { io } = context
  const parsed = parseCommandArgs('match', argv, OPTIONS, io)
  if (parsed === undefined) {
    return EXIT_CODE.usage
  }
  const { values, positionals } = parsed
  if (values.help) {
    io.out(MATCH_HELP)
    return EXIT_CODE.ok
  }
  if (positionals.length > 0) {
    return usageError(io, 'devhub match takes no arguments.', 'match')
  }
  const platforms: FingerprintPlatform[] = []
  for (const name of values.platform ?? []) {
    if (!isFingerprintPlatform(name)) {
      return usageError(
        io,
        `"${name}" is not a platform. Give android or ios.`,
        'match',
      )
    }
    if (!platforms.includes(name)) {
      platforms.push(name)
    }
  }

  const result = await matchBuilds(
    { platforms: platforms.length > 0 ? platforms : FINGERPRINT_PLATFORMS },
    { ...context, progress: (text) => io.err(text) },
  )
  if (result.kind === 'error') {
    return flowError(io, result, 'match')
  }
  const report = result.value
  io.out(
    values.json
      ? JSON.stringify(report, null, 2)
      : reportText(report).join('\n'),
  )
  return hasMatch(report) ? EXIT_CODE.ok : EXIT_CODE.failure
}

function isFingerprintPlatform(name: string): name is FingerprintPlatform {
  return (FINGERPRINT_PLATFORMS as readonly string[]).includes(name)
}

function reportText(report: MatchReport): string[] {
  const version =
    report.fingerprintVersion === undefined
      ? ''
      : ` (@expo/fingerprint ${report.fingerprintVersion})`
  const lines = [`Project: ${report.project}${version}`]
  const shortId = shortIds(
    report.platforms.flatMap(({ matches }) => matches.map(({ id }) => id)),
  )
  for (const { platform, hash, matches } of report.platforms) {
    lines.push('', `${platform}  ${hash}`)
    if (matches.length === 0) {
      lines.push('  No stored build matches this fingerprint.')
      continue
    }
    const rows = matches.map(({ id, eas }) => [
      shortId(id),
      platformLabel(eas.platform, eas.isForIosSimulator),
      eas.buildProfile ?? '-',
      eas.appVersion ?? '-',
      eas.gitCommitHash?.slice(0, 7) ?? '-',
      formatDate(eas.createdAt),
      formatDate(eas.expirationDate),
    ])
    lines.push(...formatTable([HEADER, ...rows]).map((row) => `  ${row}`))
  }
  if (!hasMatch(report)) {
    lines.push(
      '',
      'Run devhub sync to download the newest EAS builds. When EAS has no build with this fingerprint, make a new build.',
    )
  }
  return lines
}
