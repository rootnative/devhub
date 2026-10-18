import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { IncomingHttpHeaders } from 'node:http'

export const LOOPBACK = '127.0.0.1'

export function createToken(): string {
  return randomBytes(32).toString('base64url')
}

export function serverOrigin(port: number): string {
  return `http://${LOOPBACK}:${port}`
}

export type GuardRequest = {
  method: string
  /** `true` for a path under `/api/`. */
  api: boolean
  headers: IncomingHttpHeaders
}

export type Refusal = { status: 401 | 403; message: string }

/**
 * Checks a request before the server reads its body. Every request must
 * name the server in `Host`, which stops a DNS rebinding attack. An API
 * call must have the token. A POST must come from the page, with JSON.
 */
export function refusal(
  request: GuardRequest,
  { port, token }: { port: number; token: string },
): Refusal | undefined {
  const host = `${LOOPBACK}:${port}`
  if (request.headers.host !== host) {
    return {
      status: 403,
      message: `DevHub accepts only requests to ${host}. Open the URL that devhub ui printed.`,
    }
  }
  if (!request.api) {
    return undefined
  }
  if (!hasToken(request.headers.authorization, token)) {
    return {
      status: 401,
      message:
        'The request has no valid token. Open the URL that devhub ui printed.',
    }
  }
  if (request.method !== 'POST') {
    return undefined
  }
  const origin = serverOrigin(port)
  if (request.headers.origin !== origin) {
    return {
      status: 403,
      message: `DevHub accepts a POST request only from the page at ${origin}.`,
    }
  }
  if (mediaType(request.headers['content-type']) !== 'application/json') {
    return {
      status: 403,
      message: 'A POST request must have the type application/json.',
    }
  }
  return undefined
}

function hasToken(header: string | undefined, token: string): boolean {
  const match = /^Bearer (\S+)$/.exec(header ?? '')
  if (match?.[1] === undefined) {
    return false
  }
  const given = Buffer.from(match[1])
  const expected = Buffer.from(token)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

function mediaType(header: string | undefined): string {
  return (header ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
}
