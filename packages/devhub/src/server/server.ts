import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import {
  createServer,
  type IncomingMessage,
  type OutgoingHttpHeaders,
  type ServerResponse,
} from 'node:http'
import type { AddressInfo } from 'node:net'
import type { CliContext } from '../cli/context'
import { errorMessage } from '../flow/result'
import { API_ROUTES, apiError, type ApiResponse } from './api'
import { contentType, pageFile } from './files'
import { LOOPBACK, refusal, serverOrigin } from './guard'

export type UiServerOptions = {
  /** `0`: a free port that the OS selects. */
  port: number
  token: string
  /** The folder of the built page. */
  files: string
  context: CliContext
}

export type UiServer = {
  /** The URL of the page, with the token in the fragment. */
  url: string
  port: number
  /** The number of API calls that run now. */
  busy: () => number
  /** Stops new connections, and resolves when the running calls end. */
  close: () => Promise<void>
}

const MAX_BODY_BYTES = 64 * 1024

// The server sends no CORS headers, so a page of another origin cannot read
// a response. react-native-web writes its styles into <style> elements at
// run time and supports no nonce, so the page needs 'unsafe-inline' for
// styles. Scripts stay 'self'.
const SECURITY_HEADERS: OutgoingHttpHeaders = {
  'Content-Security-Policy':
    "default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
}

/** Starts the `devhub ui` server on 127.0.0.1, never on another address. */
export async function startUiServer(
  options: UiServerOptions,
): Promise<UiServer> {
  let port = options.port
  let busy = 0
  const server = createServer((request, response) => {
    handle(request, response).catch((error: unknown) => {
      const message = `DevHub hit an error that it did not expect: ${errorMessage(error)}`
      options.context.io.err(message)
      if (!response.headersSent) {
        sendJson(response, apiError(500, message))
      } else {
        response.destroy()
      }
    })
  })

  async function handle(
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> {
    const method = request.method ?? 'GET'
    const { pathname } = new URL(request.url ?? '/', serverOrigin(port))
    const api = pathname === '/api' || pathname.startsWith('/api/')
    const refused = refusal(
      { method, api, headers: request.headers },
      { port, token: options.token },
    )
    if (refused !== undefined) {
      request.resume()
      if (api) {
        sendJson(response, apiError(refused.status, refused.message))
      } else {
        sendText(response, refused.status, refused.message)
      }
      return
    }
    if (!api) {
      request.resume()
      await sendPageFile(response, method, options.files, pathname)
      return
    }

    const route = Object.hasOwn(API_ROUTES, pathname)
      ? API_ROUTES[pathname]
      : undefined
    if (route === undefined) {
      request.resume()
      sendJson(response, apiError(404, `DevHub has no API ${pathname}.`))
      return
    }
    if (method !== route.method) {
      request.resume()
      sendJson(
        response,
        apiError(405, `Use ${route.method} for ${pathname}.`),
        { Allow: route.method },
      )
      return
    }
    busy++
    try {
      const body = method === 'POST' ? await readJsonBody(request) : undefined
      sendJson(
        response,
        body?.error ?? (await route.handle(body?.value, options.context)),
      )
    } finally {
      busy--
    }
  }

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port, LOOPBACK, () => {
      server.off('error', reject)
      resolve()
    })
  })
  port = (server.address() as AddressInfo).port

  return {
    url: `${serverOrigin(port)}/#token=${options.token}`,
    port,
    busy: () => busy,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve())
      }),
  }
}

type BodyResult = { value?: unknown; error?: ApiResponse }

async function readJsonBody(request: IncomingMessage): Promise<BodyResult> {
  const chunks: Buffer[] = []
  let size = 0
  // Read to the end, so the response can still go out on this connection.
  for await (const chunk of request as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size <= MAX_BODY_BYTES) {
      chunks.push(chunk)
    }
  }
  if (size > MAX_BODY_BYTES) {
    return {
      error: apiError(
        413,
        `The request body is larger than ${MAX_BODY_BYTES} bytes.`,
      ),
    }
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') {
    return {}
  }
  try {
    return { value: JSON.parse(text) }
  } catch {
    return { error: apiError(400, 'The request body is not valid JSON.') }
  }
}

async function sendPageFile(
  response: ServerResponse,
  method: string,
  root: string,
  pathname: string,
): Promise<void> {
  if (method !== 'GET' && method !== 'HEAD') {
    sendText(response, 405, 'Use GET for a file of the page.', {
      Allow: 'GET, HEAD',
    })
    return
  }
  const file = pageFile(root, pathname)
  const info =
    file === undefined ? undefined : await stat(file).catch(() => undefined)
  if (file === undefined || info === undefined || !info.isFile()) {
    sendText(response, 404, 'DevHub has no such file.')
    return
  }
  response.writeHead(200, {
    ...SECURITY_HEADERS,
    'Content-Type': contentType(file),
    'Content-Length': info.size,
    'Cache-Control': 'no-cache',
  })
  if (method === 'HEAD') {
    response.end()
    return
  }
  createReadStream(file)
    .on('error', () => response.destroy())
    .pipe(response)
}

function sendJson(
  response: ServerResponse,
  { status, body }: ApiResponse,
  headers: OutgoingHttpHeaders = {},
): void {
  const text = JSON.stringify(body)
  response.writeHead(status, {
    ...SECURITY_HEADERS,
    ...headers,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
  })
  response.end(text)
}

function sendText(
  response: ServerResponse,
  status: number,
  text: string,
  headers: OutgoingHttpHeaders = {},
): void {
  response.writeHead(status, {
    ...SECURITY_HEADERS,
    ...headers,
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
  })
  response.end(text)
}
