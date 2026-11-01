export const HOST_KEY = 'devhub-host'

/** The height of the toolbar, which is the title bar of the desktop window. */
export const TITLE_BAR_HEIGHT = 48

/**
 * `desktop` in the window of the desktop app, which adds `host=desktop` to
 * the fragment. Only the title bar parts depend on the host.
 */
export type Host = 'browser' | 'desktop'

/**
 * A fragment with a token is a new devhub ui run, so it decides the host,
 * also when it names none. A reload has no fragment, and the page uses the
 * host that it stored.
 */
export function resolveHost(hash: string, stored: string | null): Host {
  const fragment = new URLSearchParams(hash.replace(/^#/, ''))
  const value = fragment.has('token') ? fragment.get('host') : stored
  return value === 'desktop' ? 'desktop' : 'browser'
}
