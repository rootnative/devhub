import { describe, expect, it } from 'vitest'
import { frameOptions, TITLE_BAR_HEIGHT, WINDOW_COLORS } from '../chrome'

describe('frameOptions', () => {
  it('gives macOS the traffic lights and an overlay with no color', () => {
    expect(frameOptions('darwin', false)).toEqual({
      backgroundColor: WINDOW_COLORS.light.surface,
      titleBarStyle: 'hidden',
      titleBarOverlay: { height: TITLE_BAR_HEIGHT },
    })
    expect(frameOptions('darwin', true).backgroundColor).toBe(
      WINDOW_COLORS.dark.surface,
    )
  })

  it.each(['win32', 'linux'])(
    'paints the overlay of %s in the colors of the page',
    (platform) => {
      expect(frameOptions(platform, false)).toEqual({
        backgroundColor: WINDOW_COLORS.light.surface,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
          color: WINDOW_COLORS.light.surface,
          symbolColor: WINDOW_COLORS.light.onSurface,
          height: TITLE_BAR_HEIGHT,
        },
      })
      expect(frameOptions(platform, true)).toEqual({
        backgroundColor: WINDOW_COLORS.dark.surface,
        titleBarStyle: 'hidden',
        titleBarOverlay: {
          color: WINDOW_COLORS.dark.surface,
          symbolColor: WINDOW_COLORS.dark.onSurface,
          height: TITLE_BAR_HEIGHT,
        },
      })
    },
  )
})
