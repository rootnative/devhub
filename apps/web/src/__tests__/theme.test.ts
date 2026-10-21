import { describe, expect, it } from 'vitest'
import { darkTheme, lightTheme } from '../theme'

function channels(hex: string): [number, number, number] {
  const value = (start: number) => parseInt(hex.slice(start, start + 2), 16)
  return [value(1), value(3), value(5)]
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const high = Math.max(luminance(a), luminance(b))
  const low = Math.min(luminance(a), luminance(b))
  return (high + 0.05) / (low + 0.05)
}

// The surfaces that hold text on the page: the page, the filled notices
// (surfaceContainer), the menu, and the dialog (surfaceContainerHigh).
const SURFACES = [
  'surface',
  'surfaceContainerLow',
  'surfaceContainer',
  'surfaceContainerHigh',
] as const

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('the %s theme', (_, theme) => {
  const { colors } = theme

  it.each(['primary', 'onSurface', 'onSurfaceVariant', 'error'] as const)(
    'gives %s 4.5:1 on each surface',
    (role) => {
      for (const surface of SURFACES) {
        expect(contrast(colors[role], colors[surface])).toBeGreaterThanOrEqual(
          4.5,
        )
      }
    },
  )

  it.each([
    ['onPrimary', 'primary'],
    ['onPrimaryContainer', 'primaryContainer'],
    ['onSecondaryContainer', 'secondaryContainer'],
    ['onErrorContainer', 'errorContainer'],
  ] as const)('gives %s 4.5:1 on %s', (text, container) => {
    expect(contrast(colors[text], colors[container])).toBeGreaterThanOrEqual(
      4.5,
    )
  })

  it('has surfaces with no tint', () => {
    for (const surface of SURFACES) {
      const [r, g, b] = channels(colors[surface])
      expect(r === g && g === b).toBe(true)
    }
  })
})
