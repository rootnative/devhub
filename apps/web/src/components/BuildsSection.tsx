import { Card } from '@rootnative/components/card'
import { Column, Row } from '@rootnative/components/layout'
import { ListDivider } from '@rootnative/components/list'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Fragment, useState, type ReactNode } from 'react'
import { View } from 'react-native'
import type { BuildList, Device } from '../api/types'
import type { ApiState } from '../api/useApi'
import {
  groupBuilds,
  storeNotes,
  type BuildRow,
  type ProjectGroup,
} from '../logic/view'
import { MONO_FONT } from '../theme'
import { BuildTable, TABLE_MIN_WIDTH } from './BuildTable'
import { InstallButton } from './InstallButton'
import { Notice } from './Notice'

const NO_BUILD = 'The store has no builds. Run devhub sync in a project folder.'

export function BuildsSection({
  state,
  now,
  devices,
  installing,
  onInstall,
  syncResult,
}: {
  state: ApiState<BuildList>
  now: Date
  /** `undefined` while the page has no device list. */
  devices: readonly Device[] | undefined
  /** The ID of the build that installs now. */
  installing: string | undefined
  onInstall: (row: BuildRow, device: Device) => void
  /** The state of the last sync, above the builds. */
  syncResult: ReactNode
}) {
  const { colors } = useTheme()
  // The section measures its own width, because the grid gives it a
  // different part of the window at each breakpoint.
  const [width, setWidth] = useState(0)
  const table = width >= TABLE_MIN_WIDTH
  return (
    <Column
      gap="md"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <Typography variant="titleLarge" level={2}>
        Builds
      </Typography>
      {syncResult}
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
          {groupBuilds(state.value, now).map((group) =>
            table ? (
              <BuildTable
                key={group.project}
                group={group}
                devices={devices}
                installing={installing}
                onInstall={onInstall}
              />
            ) : (
              <BuildCard
                key={group.project}
                group={group}
                devices={devices}
                installing={installing}
                onInstall={onInstall}
              />
            ),
          )}
        </>
      )}
    </Column>
  )
}

/**
 * A project with its builds as stacked rows, for a narrow window. The rows
 * are plain views, not `ListItem`: its text slots take a string only, and a
 * row needs a monospace, selectable ID and an install problem in the error
 * colour.
 */
function BuildCard({
  group,
  devices,
  installing,
  onInstall,
}: {
  group: ProjectGroup
  devices: readonly Device[] | undefined
  installing: string | undefined
  onInstall: (row: BuildRow, device: Device) => void
}) {
  const { colors } = useTheme()
  const muted = colors.onSurfaceVariant
  return (
    <Card variant="outlined">
      <View style={{ padding: 16, paddingBottom: 4 }}>
        <Typography variant="titleSmall" level={3}>
          {group.project}
        </Typography>
      </View>
      {group.builds.map((row, index) => (
        <Fragment key={row.id}>
          {index > 0 && <ListDivider />}
          <View style={{ paddingHorizontal: 16, paddingVertical: 12, gap: 4 }}>
            <Row justify="space-between" gap="sm">
              <Typography
                variant="labelMedium"
                color={muted}
                style={{ fontFamily: MONO_FONT, letterSpacing: 0 }}
                selectable
              >
                {row.shortId}
              </Typography>
              <Typography variant="labelMedium" color={muted}>
                {row.size}
              </Typography>
            </Row>
            <Row justify="space-between" align="center" gap="sm">
              <Typography variant="bodyLarge" style={{ flexShrink: 1 }}>
                {row.title}
              </Typography>
              <InstallButton
                build={row.build}
                shortId={row.shortId}
                devices={devices}
                installing={installing === row.id}
                locked={installing !== undefined && installing !== row.id}
                onInstall={(device) => onInstall(row, device)}
              />
            </Row>
            <Typography variant="bodyMedium" color={muted}>
              {row.details}
            </Typography>
            {row.expiry !== '' && (
              <Typography variant="bodyMedium" color={muted}>
                {row.expiry}
              </Typography>
            )}
            {row.build.installProblem !== undefined && (
              <Typography variant="bodySmall" color={colors.error} selectable>
                {row.build.installProblem}
              </Typography>
            )}
          </View>
        </Fragment>
      ))}
    </Card>
  )
}
