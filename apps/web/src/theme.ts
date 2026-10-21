import { createMaterialTheme } from '@rootnative/core/create-theme'

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
