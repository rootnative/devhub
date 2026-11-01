import { Column, Row } from '@rootnative/components/layout'
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
  end: { flexShrink: 0 },
  rule: { height: 1 },
})

/**
 * The toolbar of the page. In the desktop app, it is the title bar of the
 * window: it moves the window, and it keeps clear of the window buttons.
 */
export function TitleBar({
  host,
  title,
  subtitle,
  trailing,
}: {
  host: Host
  title: string
  /** One line under the title. */
  subtitle?: string
  trailing?: ReactNode
}) {
  const { colors } = useTheme()
  const desktop = host === 'desktop'
  return (
    <View style={{ backgroundColor: colors.surface }}>
      <View style={desktop ? WINDOW.drag : undefined}>
        <Row px="lg" gap="md" align="center" style={styles.bar}>
          <Row flex={1} gap="sm" align="center">
            <Mark size={24} />
            <Column flex={1}>
              <Typography variant="titleMedium" level={1} numberOfLines={1}>
                {title}
              </Typography>
              {subtitle !== undefined && (
                <Typography
                  variant="labelMedium"
                  color={colors.onSurfaceVariant}
                  numberOfLines={1}
                >
                  {subtitle}
                </Typography>
              )}
            </Column>
          </Row>
          {trailing !== undefined && (
            <View style={desktop ? WINDOW.noDrag : styles.end}>{trailing}</View>
          )}
        </Row>
      </View>
      <View style={[styles.rule, { backgroundColor: colors.outlineVariant }]} />
    </View>
  )
}
