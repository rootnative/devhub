import { Card } from '@rootnative/components/card'
import { Box, Column } from '@rootnative/components/layout'
import { List, ListDivider, ListItem } from '@rootnative/components/list'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Fragment } from 'react'
import type { BuildList, Device } from '../api/types'
import type { ApiState } from '../api/useApi'
import { groupBuilds, storeNotes, type BuildRow } from '../logic/view'
import { InstallButton } from './InstallButton'
import { Notice } from './Notice'

const NO_BUILD = 'The store has no builds. Run devhub sync in a project folder.'

export function BuildsSection({
  state,
  now,
  devices,
  installing,
  onInstall,
}: {
  state: ApiState<BuildList>
  now: Date
  /** `undefined` while the page has no device list. */
  devices: readonly Device[] | undefined
  /** The ID of the build that installs now. */
  installing: string | undefined
  onInstall: (row: BuildRow, device: Device) => void
}) {
  const { colors } = useTheme()
  return (
    <Column gap="md">
      <Typography variant="titleLarge" level={2}>
        Builds
      </Typography>
      {state.kind === 'loading' && (
        <Typography variant="bodyMedium" color={colors.onSurfaceVariant}>
          Reading the store.
        </Typography>
      )}
      {state.kind === 'error' && <Notice tone="error">{state.message}</Notice>}
      {state.kind === 'ok' && (
        <>
          {storeNotes(state.value).map((note) => (
            <Notice key={note}>{note}</Notice>
          ))}
          {state.value.builds.length === 0 && <Notice>{NO_BUILD}</Notice>}
          {groupBuilds(state.value, now).map((group) => (
            <Card key={group.project} variant="outlined">
              <List headline={group.project} headingLevel={3}>
                {group.builds.map((row, index) => (
                  <Fragment key={row.id}>
                    {index > 0 && <ListDivider />}
                    <ListItem
                      overlineText={row.shortId}
                      headlineText={row.title}
                      supportingText={
                        row.expiry === ''
                          ? row.details
                          : `${row.details}\n${row.expiry}`
                      }
                      supportingTextNumberOfLines={4}
                      trailingSupportingText={row.size}
                      trailingContent={
                        <InstallButton
                          build={row.build}
                          shortId={row.shortId}
                          devices={devices}
                          installing={installing === row.id}
                          locked={
                            installing !== undefined && installing !== row.id
                          }
                          onInstall={(device) => onInstall(row, device)}
                        />
                      }
                    />
                    {row.build.installProblem !== undefined && (
                      <Box px="md" pb="md">
                        <Typography
                          variant="bodySmall"
                          color={colors.error}
                          selectable
                        >
                          {row.build.installProblem}
                        </Typography>
                      </Box>
                    )}
                  </Fragment>
                ))}
              </List>
            </Card>
          ))}
        </>
      )}
    </Column>
  )
}
