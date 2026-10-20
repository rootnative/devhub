import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { parseArgs, type ParseArgsConfig } from 'node:util'
import { runCommand, type CommandRunner } from '../command/run-command'
import { startCommand, type CommandStarter } from '../command/start-command'
import type { FlowError } from '../flow/result'
import { downloadFile, type Downloader } from '../sync/download'

export type Io = {
  out: (text: string) => void
  err: (text: string) => void
}

export const EXIT_CODE = {
  ok: 0,
  failure: 1,
  usage: 2,
} as const

/** Everything a command reads from the process. A test gives fakes. */
export type CliContext = {
  io: Io
  cwd: string
  env: NodeJS.ProcessEnv
  platform: NodeJS.Platform
  homedir: string
  run: CommandRunner
  start: CommandStarter
  download: Downloader
  now: () => Date
  /** Resolves when the user stops a long command, for example with Ctrl+C. */
  waitForStop: () => Promise<void>
  /** The folder of the built `devhub ui` page. */
  uiFiles: string
  /** The version of the Node that runs DevHub, for example `24.11.0`. */
  nodeVersion: string
}

export function processContext(): CliContext {
  return {
    io: {
      out: (text) => process.stdout.write(`${text}\n`),
      err: (text) => process.stderr.write(`${text}\n`),
    },
    cwd: process.cwd(),
    env: process.env,
    platform: process.platform,
    homedir: os.homedir(),
    run: runCommand,
    start: startCommand,
    download: downloadFile,
    now: () => new Date(),
    waitForStop,
    // tsup bundles this file into dist/, and the build puts the page in
    // dist/ui/.
    uiFiles: fileURLToPath(new URL('./ui/', import.meta.url)),
    nodeVersion: process.versions.node,
  }
}

/**
 * Listens for SIGINT and SIGTERM only while a command waits, because a
 * listener stops the default exit. After the first signal, the listeners go,
 * so a second Ctrl+C stops the process at once.
 */
function waitForStop(): Promise<void> {
  return new Promise((resolve) => {
    const stop = () => {
      process.off('SIGINT', stop)
      process.off('SIGTERM', stop)
      resolve()
    }
    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)
  })
}

type Options = NonNullable<ParseArgsConfig['options']>

/**
 * Parses the arguments of one command. On a usage error it writes the
 * message and returns `undefined`.
 */
export function parseCommandArgs<T extends Options>(
  command: string,
  argv: readonly string[],
  options: T,
  io: Io,
) {
  try {
    return parseArgs({
      args: [...argv],
      options,
      allowPositionals: true,
      strict: true,
    })
  } catch (error) {
    usageError(
      io,
      error instanceof Error ? error.message : String(error),
      command,
    )
    return undefined
  }
}

export function usageError(io: Io, message: string, command?: string): number {
  const help = command ? `devhub ${command} --help` : 'devhub --help'
  io.err(`${message}\nRun "${help}" to see the options.`)
  return EXIT_CODE.usage
}

/** Writes the message of a failed flow, and returns its exit code. */
export function flowError(io: Io, error: FlowError, command: string): number {
  if (error.usage) {
    return usageError(io, error.message, command)
  }
  io.err(error.message)
  return EXIT_CODE.failure
}
