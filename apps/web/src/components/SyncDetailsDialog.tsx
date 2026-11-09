import { Button } from '@rootnative/components/button'
import { Dialog } from '@rootnative/components/dialog'
import { Column } from '@rootnative/components/layout'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import type { SyncDetails } from '../logic/sync'

/**
 * The Details action of the sync snackbar: why the sync did not run, or the
 * lines of `devhub sync` for each project.
 */
export function SyncDetailsDialog({
  visible,
  details,
  onDismiss,
}: {
  visible: boolean
  /** Kept while the dialog closes, so its text does not go first. */
  details: SyncDetails | undefined
  onDismiss: () => void
}) {
  const { colors } = useTheme()
  return (
    <Dialog
      visible={visible}
      onDismiss={onDismiss}
      role={details?.kind === 'error' ? 'alertdialog' : 'dialog'}
    >
      <Dialog.Title>
        {details?.kind === 'error' ? 'The sync did not run' : 'Sync details'}
      </Dialog.Title>
      <Dialog.Content>
        {details?.kind === 'error' && (
          <Typography
            variant="bodyMedium"
            color={colors.onSurfaceVariant}
            selectable
          >
            {details.message}
          </Typography>
        )}
        {details?.kind === 'report' && (
          <Column gap="md">
            {details.view.projects.map((project) => (
              <Column key={project.path} gap="xs">
                <Typography
                  variant="labelLarge"
                  color={project.failed ? colors.error : colors.onSurface}
                >
                  {project.name}
                </Typography>
                <Typography
                  variant="bodySmall"
                  color={colors.onSurfaceVariant}
                  selectable
                >
                  {[project.path, ...project.lines].join('\n')}
                </Typography>
              </Column>
            ))}
          </Column>
        )}
      </Dialog.Content>
      <Dialog.Actions>
        <Button variant="text" onPress={onDismiss}>
          Close
        </Button>
      </Dialog.Actions>
    </Dialog>
  )
}
