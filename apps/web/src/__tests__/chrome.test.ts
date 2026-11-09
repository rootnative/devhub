import { describe, expect, it } from 'vitest'
import {
  THEME_COOKIE as WINDOW_THEME_COOKIE,
  TITLE_BAR_HEIGHT as WINDOW_TITLE_BAR_HEIGHT,
  WINDOW_COLORS,
} from '../../../desktop/src/chrome'
import { TITLE_BAR_HEIGHT } from '../logic/host'
import { THEME_COOKIE } from '../logic/themeCookie'
import { darkTheme, lightTheme } from '../theme'

// The desktop app paints the window and the overlay of the window buttons
// before and around the page. A change to theme.ts must change these too.
describe('the window of the desktop app', () => {
  it.each([
    ['light', lightTheme, WINDOW_COLORS.light],
    ['dark', darkTheme, WINDOW_COLORS.dark],
  ])('uses the %s colors of the frame of the page', (_, theme, window) => {
    expect(window).toEqual({
      frame: theme.colors.surfaceContainerLow,
      onFrame: theme.colors.onSurface,
    })
  })

  it('has the height of the toolbar as its title bar', () => {
    expect(WINDOW_TITLE_BAR_HEIGHT).toBe(TITLE_BAR_HEIGHT)
  })

  it('reads the theme choice from the cookie that the page writes', () => {
    expect(WINDOW_THEME_COOKIE).toBe(THEME_COOKIE)
  })
})
