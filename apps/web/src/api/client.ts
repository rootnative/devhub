export type ApiResult<T> =
  { kind: 'ok'; value: T } | { kind: 'error'; message: string }

export const NO_TOKEN =
  'This page has no token. Open the URL that devhub ui printed in the terminal.'

export const TOKEN_REFUSED =
  'DevHub did not accept the token of this page. Each run of devhub ui makes a new token. Open the URL that devhub ui printed in the terminal.'

export const NO_ANSWER =
  'DevHub does not answer. Run devhub ui again, and open the URL that it prints.'

export type FetchInit = {
  method?: 'POST'
  headers: Record<string, string>
  body?: string
}

export type Fetcher = (
  input: string,
  init: FetchInit,
) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>

/** Reads one API route with the token of this devhub ui run. */
export function getJson<T>(
  route: string,
  token: string,
  fetcher: Fetcher = fetch,
): Promise<ApiResult<T>> {
  return call(route, { headers: { Authorization: `Bearer ${token}` } }, fetcher)
}

/**
 * Sends `body` as JSON to one API route. The browser adds the `Origin`
 * header that the server checks.
 */
export function postJson<T>(
  route: string,
  token: string,
  body: unknown,
  fetcher: Fetcher = fetch,
): Promise<ApiResult<T>> {
  return call(
    route,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    fetcher,
  )
}

async function call<T>(
  route: string,
  init: FetchInit,
  fetcher: Fetcher,
): Promise<ApiResult<T>> {
  let response
  try {
    response = await fetcher(route, init)
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
