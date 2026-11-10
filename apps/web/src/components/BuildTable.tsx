import { Tooltip } from '@rootnative/components/tooltip'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { View, type TextStyle, type ViewStyle } from 'react-native'
import type { Device } from '../api/types'
import type { InstallTargets } from '../logic/install'
import { buildCount } from '../logic/sidebar'
import { platformOf } from '../logic/summary'
import { tintToken, type RowTint } from '../logic/tint'
import type { BuildCells, BuildRow, ProjectGroup } from '../logic/view'
import { MONO_FONT } from '../theme'
import { HueIcon, PlatformIcon, useHue } from './IconTile'
import { InstallButton } from './InstallButton'
import { Cascade, CascadeItem, RowTint as Tint } from './Motion'
import { ProjectBadge } from './ProjectBadge'

type TextKey = Exclude<
  keyof BuildCells,
  'expired' | 'fingerprintHash' | 'createdFull' | 'expiryFull'
>

const TOOLTIP_KEY: Partial<Record<TextKey, keyof BuildCells>> = {
  created: 'createdFull',
  expiry: 'expiryFull',
  fingerprint: 'fingerprintHash',
}

type Column = {
  key: TextKey
  label: string
  /** The base width. No width: the profile, with PROFILE_MIN_WIDTH. */
  width?: number
  mono?: boolean
  end?: boolean
}

const COLUMNS: readonly Column[] = [
  { key: 'id', label: 'ID', width: 72, mono: true },
  { key: 'platform', label: 'Platform', width: 96 },
  { key: 'profile', label: 'Profile' },
  { key: 'version', label: 'Version', width: 52 },
  { key: 'commit', label: 'Commit', width: 60, mono: true },
  { key: 'created', label: 'Created', width: 76 },
  { key: 'expiry', label: 'EAS expiry', width: 76 },
  { key: 'fingerprint', label: 'Fingerprint', width: 72, mono: true },
  { key: 'size', label: 'Size', width: 64, end: true },
]

// The platform and the profile cells start with a 13 px icon and a 6 px gap.
const PROFILE_MIN_WIDTH = 112
const INSTALL_WIDTH = 88
const GAP = 8
const SIDE_PADDING = 16

/** Below this width, the builds show as two-line rows. */
export const TABLE_MIN_WIDTH =
  COLUMNS.reduce(
    (sum, column) => sum + (column.width ?? PROFILE_MIN_WIDTH),
    0,
  ) +
  INSTALL_WIDTH +
  GAP * COLUMNS.length +
  SIDE_PADDING * 2

const CELL_ROW: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
}

// Each column grows with a share of the free space of a wide window that is
// in proportion to its base width. One flexible column took all of it.
function columnStyle(column: Column): ViewStyle {
  const base = column.width ?? PROFILE_MIN_WIDTH
  return { flexBasis: base, flexGrow: base, flexShrink: 0, minWidth: base }
}

/**
 * The builds as one table across the main pane, with a group row for each
 * project when the page shows all projects.
 */
export function BuildTable({
  titled,
  groups,
  devices,
  targets,
  tint,
  installing,
  onInstall,
}: {
  /** `true` for all projects: each project gets a group row. */
  titled: boolean
  groups: readonly ProjectGroup[]
  devices: readonly Device[] | undefined
  targets: InstallTargets
  tint: RowTint
  installing: string | undefined
  onInstall: (row: BuildRow, device: Device) => void
}) {
  const { colors } = useTheme()
  const rowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    paddingHorizontal: SIDE_PADDING,
  }
  const rule: ViewStyle = {
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceContainerHigh,
  }
  return (
    <View
      role="table"
      aria-label={
        titled
          ? 'Builds of all projects'
          : `Builds of ${groups[0]?.project ?? 'the project'}`
      }
    >
      <View
        role="row"
        style={[
          rowStyle,
          {
            height: 32,
            borderBottomWidth: 1,
            borderBottomColor: colors.outlineVariant,
          },
        ]}
      >
        {COLUMNS.map((column) => (
          <View
            key={column.key}
            role="columnheader"
            style={columnStyle(column)}
          >
            <Typography
              variant="labelMedium"
              color={colors.onSurfaceVariant}
              numberOfLines={1}
              style={column.end ? { textAlign: 'right' } : undefined}
            >
              {column.label}
            </Typography>
          </View>
        ))}
        <View role="columnheader" style={{ width: INSTALL_WIDTH }}>
          <Typography
            variant="labelMedium"
            color={colors.onSurfaceVariant}
            style={{ opacity: 0 }}
          >
            Install
          </Typography>
        </View>
      </View>
      {/* One flat list, so each row gets its own place in the cascade. */}
      <Cascade>
        {groups.flatMap((group) => [
          ...(titled
            ? [
                <GroupRow
                  key={`group:${group.project}`}
                  table
                  project={group.project}
                  count={group.builds.length}
                />,
              ]
            : []),
          ...group.builds.flatMap((row) => {
            const problem = row.build.installProblem
            const token = tintToken(tint, row.id)
            const main = (
              <CascadeItem
                key={row.id}
                role="row"
                style={[
                  rowStyle,
                  problem === undefined ? rule : undefined,
                  { minHeight: 38, paddingVertical: 4 },
                ]}
              >
                {token !== undefined && <Tint key={token} />}
                {COLUMNS.map((column) => (
                  <View
                    key={column.key}
                    role="cell"
                    style={columnStyle(column)}
                  >
                    <Cell column={column} row={row} />
                  </View>
                ))}
                <View
                  role="cell"
                  style={{ width: INSTALL_WIDTH, alignItems: 'flex-end' }}
                >
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
                </View>
              </CascadeItem>
            )
            if (problem === undefined) {
              return [main]
            }
            return [
              main,
              <CascadeItem
                key={`${row.id}:problem`}
                style={[
                  rule,
                  { paddingHorizontal: SIDE_PADDING, paddingBottom: 8 },
                ]}
              >
                <Typography variant="bodySmall" color={colors.error} selectable>
                  {problem}
                </Typography>
              </CascadeItem>,
            ]
          }),
        ])}
      </Cascade>
    </View>
  )
}

/** The name and the build count of a project, over its builds. */
export function GroupRow({
  project,
  count,
  table = false,
}: {
  project: string
  count: number
  /** In the table, the row has the row roles. */
  table?: boolean
}) {
  const { colors } = useTheme()
  return (
    <CascadeItem
      role={table ? 'row' : undefined}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        height: 30,
        paddingHorizontal: SIDE_PADDING,
        backgroundColor: colors.surfaceContainerLow,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceContainerHigh,
      }}
    >
      <View
        role={table ? 'rowheader' : undefined}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
      >
        <ProjectBadge project={project} size={16} />
        <Typography variant="labelLarge" level={3}>
          {project}
        </Typography>
        <Typography variant="labelMedium" color={colors.onSurfaceVariant}>
          {buildCount(count)}
        </Typography>
      </View>
    </CascadeItem>
  )
}

function Cell({ column, row }: { column: Column; row: BuildRow }) {
  const { colors } = useTheme()
  const red = useHue('red')
  const { cells } = row
  const expired = column.key === 'expiry' && cells.expired
  const style: TextStyle = {
    ...(column.mono ? { fontFamily: MONO_FONT, letterSpacing: 0 } : {}),
    ...(column.end ? { textAlign: 'right' } : {}),
    ...(expired ? { textDecorationLine: 'line-through' } : {}),
    flexShrink: 1,
  }
  const text = (
    <Typography
      variant="bodySmall"
      color={
        expired
          ? red.ink
          : column.key === 'fingerprint'
            ? colors.onSurfaceVariant
            : colors.onSurface
      }
      numberOfLines={1}
      style={style}
      selectable={column.key === 'id'}
      aria-label={expired ? row.expiry : undefined}
    >
      {cells[column.key]}
    </Typography>
  )
  if (column.key === 'platform') {
    return (
      <View style={CELL_ROW}>
        <PlatformIcon platform={platformOf(row.build)} size={13} />
        {text}
      </View>
    )
  }
  if (column.key === 'profile') {
    const eas = row.build.source === 'eas'
    return (
      <View style={CELL_ROW}>
        <HueIcon
          icon={eas ? 'eas-build' : 'local-build'}
          hue={eas ? 'sky' : 'slate'}
          size={13}
        />
        {text}
      </View>
    )
  }
  const tooltipKey = TOOLTIP_KEY[column.key]
  const tooltip = tooltipKey === undefined ? undefined : cells[tooltipKey]
  if (typeof tooltip !== 'string') {
    return text
  }
  return (
    <Tooltip side="top" duration={0} anchor={text}>
      {tooltip}
    </Tooltip>
  )
}
