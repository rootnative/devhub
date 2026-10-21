import { Button } from '@rootnative/components/button'
import { Chip } from '@rootnative/components/chip'
import { Row } from '@rootnative/components/layout'
import { Tooltip } from '@rootnative/components/tooltip'
import { useTheme } from '@rootnative/core'
import type { EasStatus } from '../logic/whoami'

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
  const syncButton = (
    <Button
      variant="tonal"
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
    <Row gap="sm" align="center">
      <Chip
        contentColor={eas.tone === 'warn' ? colors.error : undefined}
        accessibilityLiveRegion="polite"
      >
        {eas.label}
      </Chip>
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
