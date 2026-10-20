/**
 * The first line of `devhub ui --no-open --json` on stdout is a JSON object
 * with the URL and the port of the server. The CLI writes it in more than
 * one line, so the reader collects stdout until the object is complete.
 */
export type UiAnnouncement = { url: string; port: number }

export const LOOPBACK = '127.0.0.1'

/**
 * Reads the announcement from the stdout text that the app has so far.
 * Returns `undefined` while the object is not complete. A text that holds a
 * complete object with the wrong shape gives `undefined` as well, so the
 * app then waits for the child to exit.
 */
export function readAnnouncement(stdout: string): UiAnnouncement | undefined {
  const start = stdout.indexOf('{')
  if (start === -1) {
    return undefined
  }
  let end = stdout.indexOf('}', start)
  while (end !== -1) {
    const candidate = parseAnnouncement(stdout.slice(start, end + 1))
    if (candidate !== undefined) {
      return candidate
    }
    end = stdout.indexOf('}', end + 1)
  }
  return undefined
}

function parseAnnouncement(text: string): UiAnnouncement | undefined {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return undefined
  }
  if (typeof value !== 'object' || value === null) {
    return undefined
  }
  const { url, port } = value as Record<string, unknown>
  if (
    typeof url !== 'string' ||
    typeof port !== 'number' ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    return undefined
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return undefined
  }
  if (
    parsed.protocol !== 'http:' ||
    parsed.hostname !== LOOPBACK ||
    parsed.port !== String(port)
  ) {
    return undefined
  }
  return { url, port }
}
