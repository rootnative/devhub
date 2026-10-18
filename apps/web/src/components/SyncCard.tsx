import { Button } from '@rootnative/components/button'
import { Card } from '@rootnative/components/card'
import { Column } from '@rootnative/components/layout'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import type { ApiResult } from '../api/client'
import type { SyncReport } from '../api/types'
import { NO_PROJECT, syncView } from '../logic/sync'
import { Notice } from './Notice'

export type SyncState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; result: ApiResult<SyncReport> }

const RUNNING =
  'The sync runs. It downloads each new dev client build of each project that DevHub knows. The terminal of devhub ui shows the progress.'

export function SyncCard({
  state,
  onClose,
}: {
  state: SyncState
  onClose: () => void
}) {
  const { colors } = useTheme()
  if (state.kind === 'idle') {
    return null
  }
  if (state.kind === 'running') {
    return <Notice>{RUNNING}</Notice>
  }
  const { result } = state
  if (result.kind === 'error') {
    return (
      <Card
        variant="filled"
        containerColor={colors.errorContainer}
        accessibilityLiveRegion="polite"
      >
        <Card.Content>
          <Typography variant="titleSmall" color={colors.onErrorContainer}>
            The sync did not run
          </Typography>
          <Typography
            variant="bodyMedium"
            color={colors.onErrorContainer}
            selectable
          >
            {result.message}
          </Typography>
        </Card.Content>
        <Card.Actions>
          <Button variant="text" onPress={onClose}>
            Close
          </Button>
        </Card.Actions>
      </Card>
    )
  }
  const view = syncView(result.value)
  return (
    <Card variant="outlined" accessibilityLiveRegion="polite">
      <Card.Content>
        <Typography variant="titleSmall">
          {view.failed
            ? 'The sync is done. Some projects or builds failed.'
            : 'The sync is done.'}
        </Typography>
        {view.projects.length === 0 && (
          <Typography variant="bodyMedium" color={colors.onSurfaceVariant}>
            {NO_PROJECT}
          </Typography>
        )}
        {view.projects.map((project) => (
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
      </Card.Content>
      <Card.Actions>
        <Button variant="text" onPress={onClose}>
          Close
        </Button>
      </Card.Actions>
    </Card>
  )
}
