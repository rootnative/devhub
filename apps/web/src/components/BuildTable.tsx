import { Card } from '@rootnative/components/card'
import { Tooltip } from '@rootnative/components/tooltip'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { Fragment } from 'react'
import { View, type TextStyle, type ViewStyle } from 'react-native'
import type { Device } from '../api/types'
import type { BuildCells, BuildRow, ProjectGroup } from '../logic/view'
import { InstallButton } from './InstallButton'

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

type TextKey = Exclude<keyof BuildCells, 'expired' | 'fingerprintHash'>

type Column = {
  key: TextKey
  label: string
  /** No width: the column takes the free space. */
  width?: number
  mono?: boolean
  end?: boolean
}

const COLUMNS: readonly Column[] = [
  { key: 'id', label: 'ID', width: 72, mono: true },
  { key: 'platform', label: 'Platform', width: 88 },
  { key: 'profile', label: 'Profile' },
  { key: 'version', label: 'Version', width: 52 },
  { key: 'commit', label: 'Commit', width: 60, mono: true },
  { key: 'created', label: 'Created', width: 76 },
  { key: 'expiry', label: 'EAS expiry', width: 76 },
  { key: 'fingerprint', label: 'Fingerprint', width: 72, mono: true },
  { key: 'size', label: 'Size', width: 64, end: true },
]

const PROFILE_MIN_WIDTH = 104
const INSTALL_WIDTH = 76
const GAP = 8
const SIDE_PADDING = 16

/** Below this width, the builds show as two-line list rows. */
export const TABLE_MIN_WIDTH =
  COLUMNS.reduce(
    (sum, column) => sum + (column.width ?? PROFILE_MIN_WIDTH),
    0,
  ) +
  INSTALL_WIDTH +
  GAP * COLUMNS.length +
  SIDE_PADDING * 2

function columnStyle(column: Column): ViewStyle {
  return column.width === undefined
    ? { flex: 1, minWidth: PROFILE_MIN_WIDTH }
    : { width: column.width }
}

export function BuildTable({
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
  const rowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    paddingHorizontal: SIDE_PADDING,
  }
  const rule: ViewStyle = {
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
  }
  return (
    <Card variant="outlined">
      <View style={{ padding: SIDE_PADDING, paddingBottom: 8 }}>
        <Typography variant="titleSmall" level={3}>
          {group.project}
        </Typography>
      </View>
      <View role="table" aria-label={`Builds of ${group.project}`}>
        <View role="row" style={[rowStyle, { paddingVertical: 8 }]}>
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
        {group.builds.map((row) => (
          <Fragment key={row.id}>
            <View role="row" style={[rowStyle, rule, { minHeight: 48 }]}>
              {COLUMNS.map((column) => (
                <View key={column.key} role="cell" style={columnStyle(column)}>
                  <Cell column={column} cells={row.cells} />
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
                  installing={installing === row.id}
                  locked={installing !== undefined && installing !== row.id}
                  onInstall={(device) => onInstall(row, device)}
                />
              </View>
            </View>
            {row.build.installProblem !== undefined && (
              <View
                style={{ paddingHorizontal: SIDE_PADDING, paddingBottom: 12 }}
              >
                <Typography variant="bodySmall" color={colors.error} selectable>
                  {row.build.installProblem}
                </Typography>
              </View>
            )}
          </Fragment>
        ))}
      </View>
    </Card>
  )
}

function Cell({ column, cells }: { column: Column; cells: BuildCells }) {
  const { colors } = useTheme()
  const expired = column.key === 'expiry' && cells.expired
  const style: TextStyle = {
    ...(column.mono ? { fontFamily: MONO, letterSpacing: 0 } : {}),
    ...(column.end ? { textAlign: 'right' } : {}),
    ...(expired ? { textDecorationLine: 'line-through' } : {}),
  }
  const text = (
    <Typography
      variant="bodySmall"
      color={expired ? colors.onSurfaceVariant : colors.onSurface}
      numberOfLines={1}
      style={style}
      selectable={column.key === 'id'}
      aria-label={
        expired ? `EAS deleted its copy on ${cells.expiry}` : undefined
      }
    >
      {cells[column.key]}
    </Typography>
  )
  if (column.key !== 'fingerprint' || cells.fingerprintHash === undefined) {
    return text
  }
  return (
    <Tooltip side="top" duration={0} anchor={text}>
      {cells.fingerprintHash}
    </Tooltip>
  )
}
