import { describe, expect, it } from 'vitest'
import {
  TITLE_BAR_HEIGHT as WINDOW_TITLE_BAR_HEIGHT,
  WINDOW_COLORS,
} from '../../../desktop/src/chrome'
import { TITLE_BAR_HEIGHT } from '../logic/host'
import { darkTheme, lightTheme } from '../theme'

// The desktop app paints the window and the overlay of the window buttons
// before and around the page. A change to theme.ts must change these too.
describe('the window of the desktop app', () => {
  it.each([
    ['light', lightTheme, WINDOW_COLORS.light],
    ['dark', darkTheme, WINDOW_COLORS.dark],
  ])('uses the %s colors of the page', (_, theme, window) => {
    expect(window).toEqual({
      surface: theme.colors.surface,
      onSurface: theme.colors.onSurface,
    })
  })

  it('has the height of the toolbar as its title bar', () => {
    expect(WINDOW_TITLE_BAR_HEIGHT).toBe(TITLE_BAR_HEIGHT)
  })
})
