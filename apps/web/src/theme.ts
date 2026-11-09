import type { Shape, Theme, Typography } from '@rootnative/core'
import { createMaterialTheme } from '@rootnative/core/create-theme'
import type { TextStyle } from 'react-native'

/**
 * The tones of the mark. LIGHT_TONES and DARK_TONES in
 * scripts/build-brand.mjs, and the tokens --rn-accent and --rn-accent-strong
 * in docs/src/css/custom.css, hold the same values. Change them together.
 */
export const LIGHT_TONES = { soft: '#f59e0b', strong: '#b45309' }
export const DARK_TONES = { soft: '#fde68a', strong: '#fbbf24' }

// The palette keeps the generated primary (#855300 in light mode). The strong
// tone of the mark is only 4.1:1 on surfaceContainerHigh, where the dialog
// puts its text button. `vibrant` keeps the amber hue in the secondary
// container of the tonal buttons. `neutral` removes the tint of the surfaces.
const themes = createMaterialTheme(LIGHT_TONES.soft, {
  variant: 'vibrant',
  surfaceTone: 'neutral',
})

// The MD3 type scale and corners are sized for touch. A desktop window shows
// more rows with smaller text, no letter spacing, and smaller corners. Each
// entry is [fontSize, lineHeight]. The emphasized role gets the same size.
const DESKTOP_TYPE: { [role: string]: readonly [number, number] | undefined } =
  {
    headlineLarge: [26, 32],
    headlineMedium: [22, 28],
    headlineSmall: [18, 24],
    titleLarge: [17, 22],
    titleMedium: [14, 20],
    titleSmall: [13, 18],
    bodyLarge: [14, 20],
    bodyMedium: [13, 18],
    bodySmall: [12, 16],
    labelLarge: [13, 18],
    labelMedium: [12, 16],
    labelSmall: [11, 14],
  }

const DESKTOP_CORNERS: Partial<Shape> = {
  cornerExtraSmall: 4,
  cornerSmall: 6,
  cornerMedium: 8,
  cornerLarge: 10,
  cornerExtraLarge: 12,
}

function desktopTheme(theme: Theme): Theme {
  const typography: Typography = { ...theme.typography }
  for (const role of Object.keys(typography) as (keyof Typography)[]) {
    const size = DESKTOP_TYPE[role.replace(/Emphasized$/, '')]
    if (size !== undefined) {
      typography[role] = {
        ...typography[role],
        fontSize: size[0],
        lineHeight: size[1],
        letterSpacing: 0,
      }
    }
  }
  return {
    ...theme,
    typography,
    shape: { ...theme.shape, ...DESKTOP_CORNERS },
  }
}

export const lightTheme = desktopTheme(themes.lightTheme)
export const darkTheme = desktopTheme(themes.darkTheme)

/** For IDs and hashes, so each character has the same width. */
export const MONO_FONT =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

/**
 * For an ID or a path with no space to break at, such as a simulator UDID or
 * the store path: it wraps at any character. react-native-web passes
 * `wordBreak` to the browser, but the React Native type does not have it.
 */
export const MONO_WRAP = {
  fontFamily: MONO_FONT,
  letterSpacing: 0,
  wordBreak: 'break-all',
} as TextStyle

export type Hue =
  'violet' | 'blue' | 'green' | 'sky' | 'slate' | 'teal' | 'amber' | 'red'

/** `tint` is the tile, and `ink` the icon or the text on the page. */
export type HueTone = { tint: string; ink: string }

/**
 * One hue for one meaning, for the icon tiles, the platform icons, and the
 * state of a value. Amber is the brand and a warning, violet builds, blue
 * devices and iOS, green Android and OK, sky EAS, teal the size on disk,
 * slate local builds and settings, and red an expired copy and a failure.
 */
export const HUES: Record<'light' | 'dark', Record<Hue, HueTone>> = {
  light: {
    violet: { tint: '#ede8fd', ink: '#7c3aed' },
    blue: { tint: '#e0eafe', ink: '#2563eb' },
    green: { tint: '#dcf5e3', ink: '#15803d' },
    sky: { tint: '#ddf0fb', ink: '#0369a1' },
    slate: { tint: '#eef1f4', ink: '#64748b' },
    teal: { tint: '#d7f3ef', ink: '#0f766e' },
    amber: { tint: '#fdf0d5', ink: LIGHT_TONES.strong },
    red: { tint: '#fde4e2', ink: '#dc2626' },
  },
  dark: {
    violet: { tint: 'rgba(167, 139, 250, 0.16)', ink: '#b49cfc' },
    blue: { tint: 'rgba(96, 140, 250, 0.16)', ink: '#7aa7ff' },
    green: { tint: 'rgba(74, 222, 128, 0.13)', ink: '#4ade80' },
    sky: { tint: 'rgba(56, 189, 248, 0.14)', ink: '#38bdf8' },
    slate: { tint: 'rgba(148, 163, 184, 0.14)', ink: '#94a3b8' },
    teal: { tint: 'rgba(45, 212, 191, 0.14)', ink: '#2dd4bf' },
    amber: { tint: 'rgba(251, 191, 36, 0.14)', ink: DARK_TONES.strong },
    red: { tint: 'rgba(248, 113, 113, 0.15)', ink: '#f87171' },
  },
}

export type AvatarTone = { container: string; content: string }

// The store has no app icon of a project, so the avatar of a project is its
// initials on one of these hues. Red is not one of them: it reads as an
// error.
const AVATAR_SEEDS = [
  '#2563eb',
  '#0d9488',
  '#7c3aed',
  LIGHT_TONES.soft,
  '#c026d3',
  '#65a30d',
]

const avatarThemes = AVATAR_SEEDS.map((seed) =>
  createMaterialTheme(seed, { variant: 'vibrant' }),
)

/** The avatar colors of the projects, in each mode. */
export const AVATAR_TONES: Record<'light' | 'dark', AvatarTone[]> = {
  light: avatarThemes.map(({ lightTheme: { colors } }) => ({
    container: colors.primary,
    content: colors.onPrimary,
  })),
  dark: avatarThemes.map(({ darkTheme: { colors } }) => ({
    container: colors.primary,
    content: colors.onPrimary,
  })),
}
