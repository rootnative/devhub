import { parseArgs } from 'node:util'
import { version } from '../index'

export type Io = {
  out: (text: string) => void
  err: (text: string) => void
}

export const EXIT_CODE = {
  ok: 0,
  failure: 1,
  usage: 2,
} as const

const processIo: Io = {
  out: (text) => process.stdout.write(`${text}\n`),
  err: (text) => process.stderr.write(`${text}\n`),
}

const HELP = `RootNative DevHub ${version}
Keep every dev build. Launch any one in one click.

Usage: devhub [options]

Options:
  -h, --help     Show this help.
  -v, --version  Show the version.

DevHub has no commands yet.`

export async function run(
  argv: readonly string[],
  io: Io = processIo,
): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({
      args: [...argv],
      options: {
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
      allowPositionals: true,
      strict: true,
    })
  } catch (error) {
    io.err(
      `${error instanceof Error ? error.message : String(error)}\nRun "devhub --help" to see the options.`,
    )
    return EXIT_CODE.usage
  }

  if (parsed.values.version) {
    io.out(version)
    return EXIT_CODE.ok
  }

  const [command] = parsed.positionals
  if (command === undefined || parsed.values.help) {
    io.out(HELP)
    return EXIT_CODE.ok
  }

  io.err(
    `Unknown command "${command}".\nRun "devhub --help" to see the commands.`,
  )
  return EXIT_CODE.usage
}
