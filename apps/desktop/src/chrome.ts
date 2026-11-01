/**
 * The `surface` and `onSurface` colors of the page theme. The main process
 * does not import the theme of the page, so
 * apps/web/src/__tests__/chrome.test.ts compares these values with
 * apps/web/src/theme.ts.
 */
export const WINDOW_COLORS = {
  light: { surface: '#f9f9f9', onSurface: '#1b1b1b' },
  dark: { surface: '#131313', onSurface: '#e2e2e2' },
}

/** The height of the toolbar of the page, which is the title bar. */
export const TITLE_BAR_HEIGHT = 48

export type TitleBarOverlay = {
  color?: string
  symbolColor?: string
  height: number
}

export type FrameOptions = {
  backgroundColor: string
  titleBarStyle: 'hidden'
  titleBarOverlay: TitleBarOverlay
}

/**
 * The window has no title bar of the OS: the toolbar of the page is the
 * title bar. The window paints `surface` before the page loads. The overlay
 * gives the page the `titlebar-area-*` CSS variables, which hold the space
 * of the window buttons.
 */
export function frameOptions(platform: string, dark: boolean): FrameOptions {
  const colors = dark ? WINDOW_COLORS.dark : WINDOW_COLORS.light
  return {
    backgroundColor: colors.surface,
    // Not `hiddenInset`: with an overlay height, Electron puts the traffic
    // lights of `hiddenInset` 11 px from the top. With `hidden`, it centers
    // them in the height.
    titleBarStyle: 'hidden',
    // The overlay has no color on macOS.
    titleBarOverlay:
      platform === 'darwin'
        ? { height: TITLE_BAR_HEIGHT }
        : {
            color: colors.surface,
            symbolColor: colors.onSurface,
            height: TITLE_BAR_HEIGHT,
          },
  }
}
