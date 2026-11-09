import { describe, expect, it } from 'vitest'
import {
  frameOptions,
  themeSource,
  TITLE_BAR_HEIGHT,
  WINDOW_COLORS,
} from '../chrome'

describe('frameOptions', () => {
  it('gives macOS the traffic lights and an overlay with no color', () => {
    expect(frameOptions('darwin', false)).toEqual({
      backgroundColor: WINDOW_COLORS.light.frame,
      titleBarStyle: 'hidden',
      titleBarOverlay: { height: TITLE_BAR_HEIGHT },
    })
    expect(frameOptions('darwin', true).backgroundColor).toBe(
      WINDOW_COLORS.dark.frame,
    )
  })

  it.each(['win32', 'linux'])(
    'paints the overlay of %s in the colors of the page',
    (platform) => {
      expect(frameOptions(platform, false)).toEqual({
        backgroundColor: WINDOW_COLORS.light.frame,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
          color: WINDOW_COLORS.light.frame,
          symbolColor: WINDOW_COLORS.light.onFrame,
          height: TITLE_BAR_HEIGHT,
        },
      })
      expect(frameOptions(platform, true)).toEqual({
        backgroundColor: WINDOW_COLORS.dark.frame,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
          color: WINDOW_COLORS.dark.frame,
          symbolColor: WINDOW_COLORS.dark.onFrame,
          height: TITLE_BAR_HEIGHT,
        },
      })
    },
  )
})

describe('themeSource', () => {
  it('follows a light or dark choice, and the OS for any other value', () => {
    expect(themeSource('light')).toBe('light')
    expect(themeSource('dark')).toBe('dark')
    expect(themeSource('system')).toBe('system')
    expect(themeSource(undefined)).toBe('system')
    expect(themeSource('blue')).toBe('system')
  })
})
