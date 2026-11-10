import { Row } from '@rootnative/components/layout'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Fragment, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { BuildList, Device } from '../api/types'
import type { ApiState } from '../api/useApi'
import type { InstallTargets } from '../logic/install'
import { platformOf } from '../logic/summary'
import {
  groupBuilds,
  storeNotes,
  type BuildRow,
  type ProjectGroup,
} from '../logic/view'
import { MONO_FONT } from '../theme'
import { BuildTable, GroupRow, TABLE_MIN_WIDTH } from './BuildTable'
import { PlatformIcon } from './IconTile'
import { InstallButton } from './InstallButton'
import { Notice } from './Notice'

const NO_BUILD = 'The store has no builds. Run devhub sync in a project folder.'

const styles = StyleSheet.create({
  notes: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 4,
    borderBottomWidth: 1,
  },
  title: { flexShrink: 1 },
  mono: { fontFamily: MONO_FONT, letterSpacing: 0 },
})

/**
 * The builds of all projects, with a group row for each, or the builds of
 * one project. The page header names the selection, and the summary strip
 * counts it.
 */
export function BuildsSection({
  state,
  project,
  now,
  devices,
  targets,
  installing,
  onInstall,
}: {
  state: ApiState<BuildList>
  /** `undefined` for all projects. */
  project: string | undefined
  now: Date
  /** `undefined` while the page has no device list. */
  devices: readonly Device[] | undefined
  targets: InstallTargets
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
  const notes = state.kind === 'ok' && all ? storeNotes(state.value) : []
  const empty = state.kind === 'ok' && all && state.value.builds.length === 0
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {(state.kind !== 'ok' || notes.length > 0 || empty) && (
        <View style={styles.notes}>
          {state.kind === 'loading' && (
            <Typography variant="bodyMedium" color={colors.onSurfaceVariant}>
              Reading the store.
            </Typography>
          )}
          {state.kind === 'error' && (
            <Notice tone="error">{state.message}</Notice>
          )}
          {notes.map((note) => (
            <Notice key={note}>{note}</Notice>
          ))}
          {empty && <Notice>{NO_BUILD}</Notice>}
        </View>
      )}
      {groups.length > 0 &&
        (table ? (
          <BuildTable
            titled={all}
            groups={groups}
            devices={devices}
            targets={targets}
            installing={installing}
            onInstall={onInstall}
          />
        ) : (
          <BuildRows
            titled={all}
            groups={groups}
            devices={devices}
            targets={targets}
            installing={installing}
            onInstall={onInstall}
          />
        ))}
    </View>
  )
}

/**
 * The builds as stacked rows, for a narrow window. The rows are plain views,
 * not `ListItem`: its text slots take a string only, and a row needs a
 * monospace, selectable ID and an install problem in the error colour.
 */
function BuildRows({
  titled,
  groups,
  devices,
  targets,
  installing,
  onInstall,
}: {
  titled: boolean
  groups: readonly ProjectGroup[]
  devices: readonly Device[] | undefined
  targets: InstallTargets
  installing: string | undefined
  onInstall: (row: BuildRow, device: Device) => void
}) {
  const { colors } = useTheme()
  const muted = colors.onSurfaceVariant
  return (
    <View>
      {groups.map((group) => (
        <Fragment key={group.project}>
          {titled && (
            <GroupRow project={group.project} count={group.builds.length} />
          )}
          {group.builds.map((row) => (
            <View
              key={row.id}
              style={[
                styles.row,
                { borderBottomColor: colors.surfaceContainerHigh },
              ]}
            >
              <Row justify="space-between" gap="sm">
                <Typography
                  variant="labelMedium"
                  color={muted}
                  style={styles.mono}
                  selectable
                >
                  {row.shortId}
                </Typography>
                <Typography variant="labelMedium" color={muted}>
                  {row.size}
                </Typography>
              </Row>
              <Row justify="space-between" align="center" gap="sm">
                <Row align="center" gap="sm" style={styles.title}>
                  <PlatformIcon platform={platformOf(row.build)} />
                  <Typography variant="bodyLarge" style={styles.title}>
                    {row.title}
                  </Typography>
                </Row>
                <InstallButton
                  size="extraSmall"
                  build={row.build}
                  shortId={row.shortId}
                  devices={devices}
                  targets={targets}
                  installing={installing === row.id}
                  locked={installing !== undefined && installing !== row.id}
                  onInstall={(device) => onInstall(row, device)}
                />
              </Row>
              <Typography variant="bodySmall" color={muted}>
                {row.details}
              </Typography>
              {row.expiry !== '' && (
                <Typography variant="bodySmall" color={muted}>
                  {row.expiry}
                </Typography>
              )}
              {row.build.installProblem !== undefined && (
                <Typography variant="bodySmall" color={colors.error} selectable>
                  {row.build.installProblem}
                </Typography>
              )}
            </View>
          ))}
        </Fragment>
      ))}
    </View>
  )
}
