import { Row } from '@rootnative/components/layout'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import type { ReactNode } from 'react'
import { StyleSheet, View, type ViewStyle } from 'react-native'
import { TITLE_BAR_HEIGHT, type Host } from '../logic/host'
import { Mark } from './Mark'

// react-native-web writes these keys into the CSS class of the style, but
// the React Native types do not have them. Electron reads app-region for the
// drag region of the window. The titlebar-area variables of the Window
// Controls Overlay give the space of the window buttons. A browser, and
// macOS in full screen, set no variables, and the fallbacks give no space.
const WINDOW = StyleSheet.create({
  drag: {
    WebkitAppRegion: 'drag',
    paddingLeft: 'env(titlebar-area-x, 0px)',
    paddingRight:
      'calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw))',
  } as ViewStyle,
  // A control in the drag region gets no click and no hover.
  noDrag: { WebkitAppRegion: 'no-drag', flexShrink: 0 } as ViewStyle,
})

const styles = StyleSheet.create({
  bar: { height: TITLE_BAR_HEIGHT },
  control: { flexShrink: 0 },
  // The title keeps its width, and the controls at the end give way: their
  // labels cut at the end when a desktop window is narrow.
  titleGroup: { flexGrow: 1, flexShrink: 0 },
  trailing: { flexShrink: 1, minWidth: 0 },
  title: { flexShrink: 1 },
})

/**
 * The toolbar of the page, on the frame color of the sidebar. In the desktop
 * app, it is the title bar of the window: it moves the window, and it keeps
 * clear of the window buttons.
 */
export function TitleBar({
  host,
  title,
  leading,
  trailing,
}: {
  host: Host
  title: string
  /** Before the mark. */
  leading?: ReactNode
  trailing?: ReactNode
}) {
  const { colors } = useTheme()
  const desktop = host === 'desktop'
  const control = desktop ? WINDOW.noDrag : styles.control
  return (
    <View style={{ backgroundColor: colors.surfaceContainerLow }}>
      <View style={desktop ? WINDOW.drag : undefined}>
        <Row px="lg" gap="md" align="center" style={styles.bar}>
          {leading !== undefined && <View style={control}>{leading}</View>}
          <Row gap="sm" align="center" style={styles.titleGroup}>
            <Mark size={18} />
            <Typography
              variant="titleSmall"
              level={1}
              numberOfLines={1}
              style={styles.title}
            >
              {title}
            </Typography>
          </Row>
          {trailing !== undefined && (
            <View style={[control, styles.trailing]}>{trailing}</View>
          )}
        </Row>
      </View>
    </View>
  )
}
