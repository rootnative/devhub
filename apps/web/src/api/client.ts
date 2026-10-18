export type ApiResult<T> =
  { kind: 'ok'; value: T } | { kind: 'error'; message: string }

export const NO_TOKEN =
  'This page has no token. Open the URL that devhub ui printed in the terminal.'

export const TOKEN_REFUSED =
  'DevHub did not accept the token of this page. Each run of devhub ui makes a new token. Open the URL that devhub ui printed in the terminal.'

export const NO_ANSWER =
  'DevHub does not answer. Run devhub ui again, and open the URL that it prints.'

export type Fetcher = (
  input: string,
  init: { headers: Record<string, string> },
) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>

/** Reads one API route with the token of this devhub ui run. */
export async function getJson<T>(
  route: string,
  token: string,
  fetcher: Fetcher = fetch,
): Promise<ApiResult<T>> {
  let response
  try {
    response = await fetcher(route, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    return { kind: 'error', message: NO_ANSWER }
  }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = undefined
  }
  if (response.ok) {
    return { kind: 'ok', value: body as T }
  }
  return { kind: 'error', message: errorMessage(response.status, body) }
}

/** The message of a failed call: the text of the CLI when the body has one. */
export function errorMessage(status: number, body: unknown): string {
  if (status === 401) {
    return TOKEN_REFUSED
  }
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'string'
  ) {
    return body.error
  }
  return `DevHub answered with HTTP ${status}.`
}
