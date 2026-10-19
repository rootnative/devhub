import { parseArgs } from 'node:util'
import { version } from '../index'
import {
  EXIT_CODE,
  processContext,
  usageError,
  type CliContext,
} from './context'
import { devicesCommand } from './devices'
import { installCommand } from './install'
import { listCommand } from './list'
import { matchCommand } from './match'
import { syncCommand } from './sync'
import { uiCommand } from './ui'
import { whereCommand } from './where'

export { EXIT_CODE, type CliContext, type Io } from './context'

const HELP = `DevHub by Root Native ${version}
Keep every dev build. Launch any one in one click.

Usage: devhub <command> [options]

Commands:
  sync          Download the EAS dev client builds of this project.
  list          Show the stored builds.
  where <id>    Print the path of a stored build file.
  devices       List the Android devices and the iOS simulators.
  install <id>  Install a stored build on the ready device.
  match         Show the stored builds that match the code of this project.
  ui            Open the DevHub page in the browser.

Options:
  -h, --help     Show this help.
  -v, --version  Show the version.

Run "devhub <command> --help" to see the options of a command.`

const COMMANDS: Record<
  string,
  (argv: readonly string[], context: CliContext) => Promise<number>
> = {
  sync: syncCommand,
  list: listCommand,
  where: whereCommand,
  devices: devicesCommand,
  install: installCommand,
  match: matchCommand,
  ui: uiCommand,
}

export async function run(
  argv: readonly string[],
  context: Partial<CliContext> = {},
): Promise<number> {
  const full: CliContext = { ...processContext(), ...context }
  const { io } = full
  const [first, ...rest] = argv
  if (first !== undefined && !first.startsWith('-')) {
    const command = Object.hasOwn(COMMANDS, first) ? COMMANDS[first] : undefined
    if (command === undefined) {
      return usageError(io, `Unknown command "${first}".`)
    }
    return command(rest, full)
  }

  let parsed
  try {
    parsed = parseArgs({
      args: [...argv],
      options: {
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
      strict: true,
    })
  } catch (error) {
    return usageError(
      io,
      error instanceof Error ? error.message : String(error),
    )
  }
  if (parsed.values.version) {
    io.out(version)
    return EXIT_CODE.ok
  }
  io.out(HELP)
  return EXIT_CODE.ok
}
