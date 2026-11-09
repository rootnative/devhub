import { Button } from '@rootnative/components/button'
import { Icon } from '@rootnative/components/icon'
import { Row } from '@rootnative/components/layout'
import { Tooltip } from '@rootnative/components/tooltip'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { StyleSheet, View } from 'react-native'
import type { IconName } from '../icons'
import type { EasStatus } from '../logic/whoami'
import { useHue } from './IconTile'

const SYNC_ICON: IconName = 'sync'

const styles = StyleSheet.create({
  eas: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  label: { flexShrink: 1 },
})

/** The EAS login state, and the Sync button that needs the login. */
export function SyncControls({
  eas,
  syncing,
  onSync,
}: {
  eas: EasStatus
  syncing: boolean
  onSync: () => void
}) {
  const { colors } = useTheme()
  const sky = useHue('sky')
  const warn = eas.tone === 'warn'
  const syncButton = (
    <Button
      variant="filled"
      size="extraSmall"
      shape="square"
      leadingIcon={SYNC_ICON}
      loading={syncing}
      disabled={!eas.canSync}
      onPress={onSync}
      accessibilityLabel="Sync the EAS builds of each project"
      accessibilityHint={eas.reason}
    >
      Sync
    </Button>
  )
  return (
    <Row gap="md" align="center">
      <View style={styles.eas} accessibilityLiveRegion="polite">
        {eas.icon !== undefined && (
          <Icon
            source={eas.icon}
            size={15}
            color={warn ? colors.error : sky.ink}
          />
        )}
        <Typography
          variant="labelMedium"
          color={warn ? colors.error : colors.onSurfaceVariant}
          numberOfLines={1}
          style={styles.label}
        >
          {eas.label}
        </Typography>
      </View>
      {eas.reason === undefined ? (
        syncButton
      ) : (
        <Tooltip side="bottom" align="end" anchor={syncButton}>
          {eas.reason}
        </Tooltip>
      )}
    </Row>
  )
}
