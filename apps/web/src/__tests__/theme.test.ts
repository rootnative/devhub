import { describe, expect, it } from 'vitest'
import { HUES, darkTheme, lightTheme } from '../theme'

function channels(hex: string): [number, number, number] {
  const value = (start: number) => parseInt(hex.slice(start, start + 2), 16)
  return [value(1), value(3), value(5)]
}

/** A `#rrggbb` color, or an `rgba()` color painted on `base`. */
function solid(color: string, base: string): string {
  const match = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(color)
  if (match === null) {
    return color
  }
  const [r, g, b, a] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
  ]
  const under = channels(base)
  return `#${[r, g, b]
    .map((channel, index) =>
      Math.round(channel * a + (under[index] ?? 0) * (1 - a))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
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

// The surfaces that hold text on the page: the main pane
// (surfaceContainerLowest), the toolbar and the sidebar
// (surfaceContainerLow), the filled notices (surfaceContainer), and the menu
// and the dialog (surfaceContainerHigh).
const SURFACES = [
  'surfaceContainerLowest',
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

  it('has the desktop type scale, also in the emphasized roles', () => {
    const { bodyMedium, bodyMediumEmphasized, labelLarge, displayLarge } =
      theme.typography
    expect(bodyMedium).toMatchObject({
      fontSize: 13,
      lineHeight: 18,
      letterSpacing: 0,
    })
    expect(bodyMediumEmphasized).toMatchObject({ fontSize: 13, lineHeight: 18 })
    expect(Number(bodyMediumEmphasized.fontWeight)).toBeGreaterThan(
      Number(bodyMedium.fontWeight),
    )
    expect(labelLarge).toMatchObject({ fontSize: 13, letterSpacing: 0 })
    expect(displayLarge.fontSize).toBe(57)
  })

  // An icon is a graphic: 3:1 on its tile, on the main pane, and on the
  // frame. Amber and red also color the text of a problem in the main pane.
  it('gives each hue 3:1 as an icon, and amber and red 4.5:1 as text', () => {
    const hues = theme === lightTheme ? HUES.light : HUES.dark
    for (const [name, { tint, ink }] of Object.entries(hues)) {
      for (const base of [
        colors.surfaceContainerLowest,
        colors.surfaceContainerLow,
      ]) {
        expect(
          contrast(ink, solid(tint, base)),
          `${name} on its tile`,
        ).toBeGreaterThanOrEqual(3)
        expect(contrast(ink, base), `${name} icon`).toBeGreaterThanOrEqual(3)
      }
    }
    for (const { ink } of [hues.amber, hues.red]) {
      expect(
        contrast(ink, colors.surfaceContainerLowest),
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('has the desktop corners', () => {
    expect(theme.shape).toMatchObject({
      cornerExtraSmall: 4,
      cornerSmall: 6,
      cornerMedium: 8,
      cornerLarge: 10,
      cornerExtraLarge: 12,
      cornerFull: 999,
    })
  })
})
