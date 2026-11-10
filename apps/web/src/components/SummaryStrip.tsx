import { Typography } from '@rootnative/components/typography'
import { useBreakpointValue, useTheme, useThemeMode } from '@rootnative/core'
import { StyleSheet, View } from 'react-native'
import type { StripCell } from '../logic/strip'
import { HUES } from '../theme'
import { IconTile } from './IconTile'
import { RisingValue } from './Motion'

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', flexWrap: 'wrap', borderBottomWidth: 1 },
  cell: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  quarter: { width: '25%' },
  half: { width: '50%' },
  text: { flex: 1, minWidth: 0 },
  value: { fontWeight: '600', fontVariant: ['tabular-nums'] },
})

/**
 * Four facts about the selection of the page. Four columns from the medium
 * breakpoint, two by two below it. The text wraps, so a narrow cell cuts no
 * text.
 */
export function SummaryStrip({ cells }: { cells: readonly StripCell[] }) {
  const { colors } = useTheme()
  const { scheme } = useThemeMode()
  const four = useBreakpointValue({ compact: false, medium: true })
  return (
    <View style={[styles.strip, { borderBottomColor: colors.outlineVariant }]}>
      {cells.map((cell, index) => {
        const ruleStart = four ? index > 0 : index % 2 === 1
        const ruleTop = !four && index >= 2
        return (
          <View
            key={cell.key}
            accessible
            aria-label={`${cell.label}: ${cell.value}. ${cell.detail}`}
            style={[
              styles.cell,
              four ? styles.quarter : styles.half,
              {
                borderColor: colors.outlineVariant,
                borderStartWidth: ruleStart ? 1 : 0,
                borderTopWidth: ruleTop ? 1 : 0,
              },
            ]}
          >
            <IconTile icon={cell.icon} hue={cell.hue} size="large" />
            <View style={styles.text}>
              <Typography variant="labelMedium" color={colors.onSurfaceVariant}>
                {cell.label}
              </Typography>
              <RisingValue
                variant="titleLarge"
                style={styles.value}
                value={cell.value}
              />
              <Typography
                variant="labelMedium"
                color={
                  cell.detailHue === undefined
                    ? colors.onSurfaceVariant
                    : HUES[scheme][cell.detailHue].ink
                }
              >
                {cell.detail}
              </Typography>
            </View>
          </View>
        )
      })}
    </View>
  )
}
