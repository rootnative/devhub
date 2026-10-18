import { stat } from 'node:fs/promises'
import path from 'node:path'
import { errorMessage } from '../flow/result'
import { openUrlCommand } from '../server/browser'
import { createToken, LOOPBACK } from '../server/guard'
import { startUiServer, type UiServer } from '../server/server'
import { isErrnoException } from '../store/files'
import {
  EXIT_CODE,
  parseCommandArgs,
  usageError,
  type CliContext,
} from './context'

export const UI_HELP = `Usage: devhub ui [options]

Start a local server for the DevHub page, and open the page in the browser.
The server listens on ${LOOPBACK} only, and each run has a new token in the
URL. Press Ctrl+C to stop the server.

Options:
  --port <n>  The port of the server. The default is a free port.
  --no-open   Print the URL, and do not open the browser.
  --json      Print the URL and the port as JSON.
  -h, --help  Show this help.`

const OPTIONS = {
  port: { type: 'string' },
  'no-open': { type: 'boolean' },
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const

export async function uiCommand(
  argv: readonly string[],
  context: CliContext,
): Promise<number> {
  const { io } = context
  const parsed = parseCommandArgs('ui', argv, OPTIONS, io)
  if (parsed === undefined) {
    return EXIT_CODE.usage
  }
  const { values, positionals } = parsed
  if (values.help) {
    io.out(UI_HELP)
    return EXIT_CODE.ok
  }
  if (positionals.length > 0) {
    return usageError(io, 'devhub ui takes no arguments.', 'ui')
  }
  const port = values.port === undefined ? 0 : parsePort(values.port)
  if (port === undefined) {
    return usageError(
      io,
      `The port "${values.port}" is not valid. Give a number from 0 to 65535.`,
      'ui',
    )
  }

  let server: UiServer
  try {
    server = await startUiServer({
      port,
      token: createToken(),
      files: context.uiFiles,
      context,
    })
  } catch (error) {
    io.err(listenFailure(error, port))
    return EXIT_CODE.failure
  }

  io.out(
    values.json
      ? JSON.stringify({ url: server.url, port: server.port }, null, 2)
      : `DevHub by Root Native runs at ${server.url}`,
  )
  const index = path.join(context.uiFiles, 'index.html')
  if (!(await isFile(index))) {
    io.err(
      `Warning: this build of DevHub has no page. ${index} does not exist. The API works.`,
    )
  }
  io.err('Press Ctrl+C to stop the server.')
  if (!values['no-open']) {
    openBrowser(server.url, context)
  }

  await context.waitForStop()
  if (server.busy() > 0) {
    io.err(
      'A sync or an install runs now. The server stops when it ends. Press Ctrl+C again to stop it now.',
    )
  }
  await server.close()
  io.err('The server stopped.')
  return EXIT_CODE.ok
}

function parsePort(value: string): number | undefined {
  if (!/^\d{1,5}$/.test(value)) {
    return undefined
  }
  const port = Number(value)
  return port <= 65535 ? port : undefined
}

function listenFailure(error: unknown, port: number): string {
  if (isErrnoException(error) && error.code === 'EADDRINUSE') {
    return `The port ${port} is in use. Give a different port with --port, or leave out --port to use a free port.`
  }
  if (isErrnoException(error) && error.code === 'EACCES') {
    return `DevHub has no permission to use the port ${port}. Give a port from 1024 to 65535.`
  }
  return `DevHub cannot start the server on ${LOOPBACK}:${port}. ${errorMessage(error)}`
}

/** A failure only gives a warning. The printed URL still works. */
function openBrowser(url: string, context: CliContext): void {
  const command = openUrlCommand(url, context.platform)
  const warn = (reason: string) =>
    context.io.err(
      `Warning: DevHub cannot open the browser. ${reason} Open the URL by hand.`,
    )
  context
    .start(command, { cwd: context.cwd })
    .then((code) => {
      if (code !== 0 && code !== null) {
        warn(`"${command[0]}" exited with code ${code}.`)
      }
    })
    .catch((error: unknown) => {
      warn(`"${command[0]}" did not start: ${errorMessage(error)}.`)
    })
}

async function isFile(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile()
  } catch {
    return false
  }
}
