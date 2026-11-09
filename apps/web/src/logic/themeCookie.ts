import type { ThemeMode } from '@rootnative/core'

/**
 * The theme choice of Settings lives in a cookie, not in local storage:
 * `devhub ui` takes a new port at each start, local storage belongs to one
 * port, and a cookie of 127.0.0.1 belongs to each port. The desktop app reads
 * the same cookie, with the name in apps/desktop/src/chrome.ts.
 */
export const THEME_COOKIE = 'devhub-theme'

const ONE_YEAR = 365 * 24 * 60 * 60

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark'
}

/** The theme mode in a `document.cookie` string, if it holds a valid one. */
export function parseThemeMode(cookies: string): ThemeMode | undefined {
  for (const part of cookies.split(';')) {
    const [name, value] = part.trim().split('=')
    if (name === THEME_COOKIE && isThemeMode(value)) {
      return value
    }
  }
  return undefined
}

/** The `document.cookie` assignment that keeps a theme mode for a year. */
export function themeModeCookie(mode: ThemeMode): string {
  return `${THEME_COOKIE}=${mode}; Max-Age=${ONE_YEAR}; Path=/; SameSite=Strict`
}
