import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'

const styles = StyleSheet.create({
  header: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingStart: 16,
    paddingEnd: 12,
    borderBottomWidth: 1,
  },
  title: { flexShrink: 1 },
  subtitle: { flexShrink: 2 },
  trailing: { marginStart: 'auto', flexShrink: 0 },
})

/** The first row of the main pane: what the page shows. */
export function PageHeader({
  leading,
  title,
  subtitle,
  trailing,
}: {
  leading: ReactNode
  title: string
  subtitle?: string
  trailing?: ReactNode
}) {
  const { colors } = useTheme()
  return (
    <View style={[styles.header, { borderBottomColor: colors.outlineVariant }]}>
      {leading}
      <Typography
        variant="titleSmall"
        level={2}
        numberOfLines={1}
        style={styles.title}
      >
        {title}
      </Typography>
      {subtitle !== undefined && (
        <Typography
          variant="bodyMedium"
          color={colors.onSurfaceVariant}
          numberOfLines={1}
          style={styles.subtitle}
        >
          {subtitle}
        </Typography>
      )}
      {trailing !== undefined && (
        <View style={styles.trailing}>{trailing}</View>
      )}
    </View>
  )
}
