import { describe, expect, it } from 'vitest'
import {
  THEME_COOKIE,
  isThemeMode,
  parseThemeMode,
  themeModeCookie,
} from '../logic/themeCookie'

describe('isThemeMode', () => {
  it('accepts the three modes only', () => {
    expect(['system', 'light', 'dark'].every(isThemeMode)).toBe(true)
    expect(isThemeMode('Dark')).toBe(false)
    expect(isThemeMode(null)).toBe(false)
  })
})

describe('parseThemeMode', () => {
  it('reads the mode among other cookies', () => {
    expect(parseThemeMode(`a=1; ${THEME_COOKIE}=dark; b=2`)).toBe('dark')
    expect(parseThemeMode(`${THEME_COOKIE}=system`)).toBe('system')
  })

  it('gives no mode for no cookie and for a value it does not know', () => {
    expect(parseThemeMode('')).toBeUndefined()
    expect(parseThemeMode(`${THEME_COOKIE}=blue`)).toBeUndefined()
    expect(parseThemeMode(`x${THEME_COOKIE}=dark`)).toBeUndefined()
  })
})

describe('themeModeCookie', () => {
  it('keeps the mode for a year on each path of the host', () => {
    expect(themeModeCookie('light')).toBe(
      `${THEME_COOKIE}=light; Max-Age=31536000; Path=/; SameSite=Strict`,
    )
    expect(parseThemeMode(themeModeCookie('light'))).toBe('light')
  })
})
