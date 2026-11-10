import { Icon } from '@rootnative/components/icon'
import { Menu } from '@rootnative/components/menu'
import { NavigationDrawer } from '@rootnative/components/navigation-drawer'
import { Tooltip } from '@rootnative/components/tooltip'
import { Typography } from '@rootnative/components/typography'
import { useTheme } from '@rootnative/core'
import { useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import type { BuildList, DeviceReport } from '../api/types'
import type { ApiState } from '../api/useApi'
import type { DoctorState } from '../logic/doctor'
import type { InstallTargets } from '../logic/install'
import {
  countLabel,
  devicesWarning,
  projectCounts,
  scopeCount,
  setupHue,
  setupMark,
  sidebarDevices,
  switchChoices,
  type Page,
  type ProjectCount,
} from '../logic/sidebar'
import type { Hue } from '../theme'
import { IconTile, PlatformIcon, useHue } from './IconTile'
import { ProjectBadge } from './ProjectBadge'

// The build table needs TABLE_MIN_WIDTH (872 px). In a window of 1120 px:
// 1120 - 220 (sidebar) - 8 (space at the end of the main pane) - 2 (its
// border) - 15 (a classic scrollbar) = 875. The table has no padding around
// it. A change to one of these values must keep the table in view at that
// width.
export const SIDEBAR_WIDTH = 220

export const ALL_PROJECTS = 'All projects'

const LABEL = 'Projects, devices, and setup'
const ROW_HEIGHT = 28
const DEVICE_HEIGHT = 26
const ROW_START = 6
// The platform icon of a device row sits under the label of the Devices row:
// the start padding, the tile (20), and the gap (8).
const DEVICE_START = ROW_START + 20 + 8
const DOT_SIZE = 7
const PANEL_WIDTH = 60

const styles = StyleSheet.create({
  sidebar: {
    width: SIDEBAR_WIDTH,
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 8,
  },
  scroll: { flex: 1 },
  items: { gap: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingEnd: 8,
    borderRadius: 6,
  },
  label: { flex: 1, minWidth: 0 },
  count: { fontVariant: ['tabular-nums'] },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
  footer: { borderTopWidth: 1, paddingTop: 8, marginTop: 8 },
  switcher: { marginBottom: 10 },
  switcherRow: { height: 34 },
  // The panel opens beside the switcher, as a project switcher does in a
  // console: from a point at its top, past the end of the sidebar.
  panelAnchor: { position: 'absolute', top: 0, end: -20 },
  point: { width: 1, height: 1 },
  panel: { minWidth: 0, width: PANEL_WIDTH },
  panelContent: { alignItems: 'center', gap: 8, paddingVertical: 4 },
  drawer: { padding: 12 },
})

export type SidebarProps = {
  page: Page
  onPage: (page: Page) => void
  /** `undefined` for all projects. */
  project: string | undefined
  onProject: (project: string | undefined) => void
  builds: ApiState<BuildList>
  devices: ApiState<DeviceReport>
  targets: InstallTargets
  checks: DoctorState
  settingsOpen: boolean
  onSettings: () => void
}

/** The sidebar at the start of a wide window, on the frame color. */
export function Sidebar(props: SidebarProps) {
  const { colors } = useTheme()
  return (
    <View style={styles.sidebar} role="navigation" aria-label={LABEL}>
      <ScrollView style={styles.scroll}>
        <SidebarItems {...props} />
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: colors.outlineVariant }]}>
        <SettingsRow open={props.settingsOpen} onPress={props.onSettings} />
      </View>
    </View>
  )
}

/** The same rows in a modal drawer, for a narrow window. */
export function SidebarDrawer({
  visible,
  onDismiss,
  ...props
}: SidebarProps & { visible: boolean; onDismiss: () => void }) {
  const { colors } = useTheme()
  return (
    <NavigationDrawer
      visible={visible}
      onDismiss={onDismiss}
      accessibilityLabel={LABEL}
    >
      <View style={styles.drawer}>
        <SidebarItems {...props} />
        <View
          style={[styles.footer, { borderTopColor: colors.outlineVariant }]}
        >
          <SettingsRow open={props.settingsOpen} onPress={props.onSettings} />
        </View>
      </View>
    </NavigationDrawer>
  )
}

function SidebarItems({
  page,
  onPage,
  project,
  onProject,
  builds,
  devices,
  targets,
  checks,
}: SidebarProps) {
  const list = builds.kind === 'ok' ? builds.value : undefined
  const setup = setupMark(checks.result)
  const hue = setupHue(checks.result)
  const deviceWarning = devicesWarning(devices)
  const count = list === undefined ? undefined : scopeCount(list, project)
  return (
    <View style={styles.items}>
      <ProjectSwitcher
        project={project}
        counts={list === undefined ? [] : projectCounts(list)}
        onProject={onProject}
      />
      <SideRow
        leading={<IconTile icon="builds" hue="violet" />}
        label="Builds"
        selected={page === 'builds'}
        onPress={() => onPage('builds')}
        trailing={count === undefined ? undefined : <Count value={count} />}
        accessibilityLabel={
          count === undefined ? 'Builds' : countLabel('Builds', count)
        }
      />
      <SideRow
        leading={
          <IconTile
            icon={deviceWarning ? 'status-warn' : 'device-virtual'}
            hue={deviceWarning ? 'red' : 'blue'}
          />
        }
        label="Devices"
        selected={page === 'devices'}
        onPress={() => onPage('devices')}
        accessibilityLabel={
          deviceWarning ? 'Devices. See the warning.' : 'Devices'
        }
      />
      {devices.kind === 'ok' &&
        sidebarDevices(devices.value.devices, targets).map((device) => (
          <SideRow
            key={device.value}
            height={DEVICE_HEIGHT}
            start={DEVICE_START}
            dense
            leading={<PlatformIcon platform={device.platform} size={13} />}
            label={device.label}
            trailing={
              <>
                {device.target && <TargetMark />}
                <StateDot ready={device.ready} />
              </>
            }
            onPress={() => onPage('devices')}
            accessibilityLabel={device.accessibilityLabel}
          />
        ))}
      <SideRow
        leading={<IconTile icon={setup.icon} hue={hue} />}
        label="Setup"
        selected={page === 'setup'}
        onPress={() => onPage('setup')}
        trailing={
          setup.problems > 0 ? (
            <ProblemBadge count={setup.problems} hue={hue} />
          ) : undefined
        }
        accessibilityLabel={setup.accessibilityLabel}
      />
    </View>
  )
}

function SettingsRow({
  open,
  onPress,
}: {
  open: boolean
  onPress: () => void
}) {
  return (
    <SideRow
      leading={<IconTile icon="settings" hue="slate" />}
      label="Settings"
      selected={open}
      onPress={onPress}
    />
  )
}

/**
 * One row of the sidebar. The MD3 drawer item is 56 px high with a pill
 * indicator, which is large for a desktop sidebar.
 */
function SideRow({
  leading,
  label,
  trailing,
  selected = false,
  onPress,
  accessibilityLabel,
  height = ROW_HEIGHT,
  start = ROW_START,
  dense = false,
}: {
  leading: ReactNode
  label: string
  trailing?: ReactNode
  selected?: boolean
  onPress: () => void
  accessibilityLabel?: string
  height?: number
  start?: number
  dense?: boolean
}) {
  const { colors } = useTheme()
  const [hovered, setHovered] = useState(false)
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      role="button"
      aria-selected={selected}
      aria-label={accessibilityLabel ?? label}
      style={[
        styles.row,
        {
          height,
          paddingStart: start,
          backgroundColor: selected
            ? colors.surfaceContainerHighest
            : hovered
              ? colors.surfaceContainerHigh
              : 'transparent',
        },
      ]}
    >
      {leading}
      <Typography
        variant={selected ? 'labelLarge' : dense ? 'bodySmall' : 'bodyMedium'}
        color={selected || hovered ? colors.onSurface : colors.onSurfaceVariant}
        numberOfLines={1}
        style={styles.label}
      >
        {label}
      </Typography>
      {trailing}
    </Pressable>
  )
}

function Count({ value }: { value: number }) {
  const { colors } = useTheme()
  return (
    <Typography
      variant="labelMedium"
      color={colors.onSurfaceVariant}
      style={styles.count}
    >
      {String(value)}
    </Typography>
  )
}

function ProblemBadge({ count, hue }: { count: number; hue: Hue }) {
  const { colors } = useTheme()
  const tone = useHue(hue)
  return (
    <View style={[styles.badge, { backgroundColor: tone.tint }]}>
      <Typography variant="labelSmall" color={colors.onSurface}>
        {String(count)}
      </Typography>
    </View>
  )
}

/** The mark of an install target. The row label says it to a screen reader. */
function TargetMark() {
  const { colors } = useTheme()
  return (
    <View aria-hidden>
      <Icon source="install-target" size={12} color={colors.primary} />
    </View>
  )
}

/** A filled dot for a ready device, a ring in the error color otherwise. */
function StateDot({ ready }: { ready: boolean }) {
  const { colors } = useTheme()
  const green = useHue('green')
  return (
    <View
      style={[
        styles.dot,
        ready
          ? { backgroundColor: green.ink }
          : { borderWidth: 1.5, borderColor: colors.error },
      ]}
    />
  )
}

/**
 * The selected project at the top of the sidebar. A press opens a panel with
 * the other projects, and All projects.
 */
function ProjectSwitcher({
  project,
  counts,
  onProject,
}: {
  project: string | undefined
  counts: readonly ProjectCount[]
  onProject: (project: string | undefined) => void
}) {
  const { colors } = useTheme()
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const choices = switchChoices(counts, project)
  const canSwitch = choices.projects.length > 0 || choices.all
  const name = project ?? ALL_PROJECTS
  const pick = (next: string | undefined) => {
    setOpen(false)
    onProject(next)
  }
  return (
    <View style={styles.switcher}>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={!canSwitch}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        role="button"
        aria-label={canSwitch ? `${name}. Change the project` : name}
        aria-expanded={canSwitch ? open : undefined}
        style={[
          styles.row,
          styles.switcherRow,
          {
            paddingStart: ROW_START,
            backgroundColor:
              open || hovered ? colors.surfaceContainerHigh : 'transparent',
          },
        ]}
      >
        <ProjectBadge project={project} size={20} />
        <Typography variant="titleSmall" numberOfLines={1} style={styles.label}>
          {name}
        </Typography>
        {canSwitch && (
          <Icon source="chevrons" size={14} color={colors.onSurfaceVariant} />
        )}
      </Pressable>
      <Menu
        visible={open}
        onDismiss={() => setOpen(false)}
        anchor={<View style={styles.point} />}
        anchorStyle={styles.panelAnchor}
        maxHeight={480}
        style={styles.panel}
        dismissAccessibilityLabel="Close the projects"
      >
        <View style={styles.panelContent}>
          {choices.projects.map(({ project: choice, count }) => (
            <PanelChoice
              key={choice}
              project={choice}
              label={countLabel(choice, count)}
              onPress={() => pick(choice)}
            />
          ))}
          {choices.all && (
            <PanelChoice
              project={undefined}
              label={ALL_PROJECTS}
              onPress={() => pick(undefined)}
            />
          )}
        </View>
      </Menu>
    </View>
  )
}

/**
 * One project in the panel, with its name as a tooltip on hover. The tooltip
 * is controlled, because the menu moves the focus to its first item, and an
 * uncontrolled tooltip opens on focus: the first name then showed at each
 * open of the panel. The label gives the name to a screen reader.
 */
function PanelChoice({
  project,
  label,
  onPress,
}: {
  project: string | undefined
  label: string
  onPress: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <Tooltip
      side="bottom"
      visible={hovered}
      onDismiss={() => setHovered(false)}
      anchor={
        <Pressable
          onPress={onPress}
          onHoverIn={() => setHovered(true)}
          onHoverOut={() => setHovered(false)}
          role="button"
          aria-label={label}
        >
          <ProjectBadge project={project} size={36} />
        </Pressable>
      }
    >
      {project ?? ALL_PROJECTS}
    </Tooltip>
  )
}
