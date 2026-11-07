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

export const lightTheme = themes.lightTheme
export const darkTheme = themes.darkTheme

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
