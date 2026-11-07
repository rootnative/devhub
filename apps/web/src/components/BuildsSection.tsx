import { Card } from '@rootnative/components/card'
import { Column, Row } from '@rootnative/components/layout'
import { ListDivider } from '@rootnative/components/list'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Fragment, useState } from 'react'
import { View } from 'react-native'
import type { BuildList, Device } from '../api/types'
import type { ApiState } from '../api/useApi'
import { buildCount } from '../logic/sidebar'
import { ALL_PROJECTS } from './Sidebar'
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

/**
 * The builds of all projects, one card for each, or the builds of one
 * project in one table with no card title.
 */
export function BuildsSection({
  state,
  project,
  now,
  devices,
  installing,
  onInstall,
}: {
  state: ApiState<BuildList>
  /** `undefined` for all projects. */
  project: string | undefined
  now: Date
  /** `undefined` while the page has no device list. */
  devices: readonly Device[] | undefined
  /** The ID of the build that installs now. */
  installing: string | undefined
  onInstall: (row: BuildRow, device: Device) => void
}) {
  const { colors } = useTheme()
  // The section measures its own width, because a classic scrollbar takes a
  // part of the main pane that the page cannot know.
  const [width, setWidth] = useState(0)
  const table = width >= TABLE_MIN_WIDTH
  const all = project === undefined
  const groups =
    state.kind === 'ok'
      ? groupBuilds(state.value, now).filter(
          (group) => all || group.project === project,
        )
      : []
  const count = groups.reduce((sum, group) => sum + group.builds.length, 0)
  return (
    <Column
      gap="md"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <Row justify="space-between" align="baseline" gap="md">
        <Typography variant="titleLarge" level={2} style={{ flexShrink: 1 }}>
          {all ? ALL_PROJECTS : project}
        </Typography>
        {state.kind === 'ok' && (
          <Typography variant="bodyMedium" color={colors.onSurfaceVariant}>
            {buildCount(count)}
          </Typography>
        )}
      </Row>
      {state.kind === 'loading' && (
        <Typography variant="bodyMedium" color={colors.onSurfaceVariant}>
          Reading the store.
        </Typography>
      )}
      {state.kind === 'error' && <Notice tone="error">{state.message}</Notice>}
      {state.kind === 'ok' && (
        <>
          {all &&
            storeNotes(state.value).map((note) => (
              <Notice key={note}>{note}</Notice>
            ))}
          {all && state.value.builds.length === 0 && (
            <Notice>{NO_BUILD}</Notice>
          )}
          {groups.map((group) =>
            table ? (
              <BuildTable
                key={group.project}
                titled={all}
                group={group}
                devices={devices}
                installing={installing}
                onInstall={onInstall}
              />
            ) : (
              <BuildCard
                key={group.project}
                titled={all}
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
  titled,
  group,
  devices,
  installing,
  onInstall,
}: {
  /** `false` when the heading of the page names the project. */
  titled: boolean
  group: ProjectGroup
  devices: readonly Device[] | undefined
  installing: string | undefined
  onInstall: (row: BuildRow, device: Device) => void
}) {
  const { colors } = useTheme()
  const muted = colors.onSurfaceVariant
  return (
    <Card variant="outlined">
      {titled && (
        <View style={{ padding: 16, paddingBottom: 4 }}>
          <Typography variant="titleSmall" level={3}>
            {group.project}
          </Typography>
        </View>
      )}
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
