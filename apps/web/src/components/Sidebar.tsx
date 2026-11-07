import { Avatar } from '@rootnative/components/avatar'
import { Card } from '@rootnative/components/card'
import { Icon } from '@rootnative/components/icon'
import { Menu } from '@rootnative/components/menu'
import { NavigationDrawer } from '@rootnative/components/navigation-drawer'
import { Tooltip } from '@rootnative/components/tooltip'
import { Typography } from '@rootnative/components/typography'
import { useTheme, useThemeMode, type IconRenderProps } from '@rootnative/core'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { BuildList, DeviceReport } from '../api/types'
import type { ApiState } from '../api/useApi'
import type { IconName } from '../icons'
import {
  countLabel,
  devicesWarning,
  parsePage,
  projectCounts,
  projectInitials,
  projectTone,
  scopeCount,
  setupMark,
  sidebarDevices,
  switchChoices,
  type Page,
  type ProjectCount,
} from '../logic/sidebar'
import { AVATAR_TONES, MONO_WRAP } from '../theme'
import type { DoctorState } from './SetupSection'

// The build table needs TABLE_MIN_WIDTH (848 px). In a window of 1120 px:
// 1120 - 220 (sidebar) - 1 (rule) - 32 (padding of the main pane) - 15 (a
// classic scrollbar) = 852. A change to one of these values must keep the
// table in view at that width.
export const SIDEBAR_WIDTH = 220

export const ALL_PROJECTS = 'All projects'

const LABEL = 'Projects, devices, and setup'
const DEVICES_ICON: IconName = 'device-virtual'
const BUILDS_ICON: IconName = 'builds'
const SWAP_ICON: IconName = 'swap'
const ALL_ICON: IconName = 'all-projects'
// The drawer has the touch sizes of MD3 (56 px rows, 24 px icons), which are
// too large for a desktop sidebar.
const ITEM_HEIGHT = 36
const DEVICE_HEIGHT = 32
const ICON_SIZE = 20
// The start padding (16) and the icon gap (12) of the drawer item. The dot of
// a device row goes under the label of the item above it.
const DEVICE_INSET = 16 + ICON_SIZE + 12
const DOT_SIZE = 8
const PANEL_WIDTH = 64

const styles = StyleSheet.create({
  sidebar: { width: SIDEBAR_WIDTH },
  rule: { width: 1 },
  switcher: { marginBottom: 8 },
  switcherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    // The center of the 32 px avatar is then over the center of the icons
    // of the items.
    paddingHorizontal: 10,
  },
  // The panel opens beside the card, as a project switcher does in a
  // console: from a point at the top of the card, past the end of the
  // sidebar.
  panelAnchor: { position: 'absolute', top: 0, end: -20 },
  point: { width: 1, height: 1 },
  switcherName: { flex: 1 },
  panel: { minWidth: 0, width: PANEL_WIDTH, borderRadius: 24 },
  panelContent: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  item: { height: ITEM_HEIGHT },
  device: { height: DEVICE_HEIGHT, paddingStart: DEVICE_INSET },
  dotSlot: { alignItems: 'center', justifyContent: 'center' },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
  store: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, gap: 4 },
})

export type SidebarProps = {
  page: Page
  onPage: (page: Page) => void
  /** `undefined` for all projects. */
  project: string | undefined
  onProject: (project: string | undefined) => void
  builds: ApiState<BuildList>
  devices: ApiState<DeviceReport>
  checks: DoctorState
}

/** The sidebar at the start of a wide window, with a rule at its end. */
export function Sidebar({ page, onPage, ...content }: SidebarProps) {
  const { colors } = useTheme()
  return (
    <>
      <NavigationDrawer
        variant="standard"
        value={page}
        onValueChange={(value) => onPage(parsePage(value))}
        containerColor={colors.surfaceContainerLow}
        style={styles.sidebar}
        accessibilityLabel={LABEL}
      >
        <SidebarContent {...content} />
      </NavigationDrawer>
      <View style={[styles.rule, { backgroundColor: colors.outlineVariant }]} />
    </>
  )
}

/** The same content in a modal drawer, for a narrow window. */
export function SidebarDrawer({
  visible,
  onDismiss,
  page,
  onPage,
  ...content
}: SidebarProps & { visible: boolean; onDismiss: () => void }) {
  return (
    <NavigationDrawer
      visible={visible}
      onDismiss={onDismiss}
      value={page}
      onValueChange={(value) => onPage(parsePage(value))}
      accessibilityLabel={LABEL}
    >
      <SidebarContent {...content} />
    </NavigationDrawer>
  )
}

function SidebarContent({
  project,
  onProject,
  builds,
  devices,
  checks,
}: Omit<SidebarProps, 'page' | 'onPage'>) {
  const { colors } = useTheme()
  const list = builds.kind === 'ok' ? builds.value : undefined
  const setup = setupMark(checks.result)
  const deviceWarning = devicesWarning(devices)
  // The item draws an icon name at its own size. A render function gets the
  // color of the selection, and an error icon replaces it.
  const icon =
    (source: IconName, error = false) =>
    ({ color }: IconRenderProps) => (
      <Icon
        source={source}
        size={ICON_SIZE}
        color={error ? colors.error : color}
      />
    )
  return (
    <>
      <ProjectSwitcher
        project={project}
        counts={list === undefined ? [] : projectCounts(list)}
        onProject={onProject}
      />
      <NavigationDrawer.Item
        value="builds"
        label="Builds"
        style={styles.item}
        icon={icon(BUILDS_ICON)}
        badge={list === undefined ? undefined : scopeCount(list, project)}
        accessibilityLabel={
          list === undefined
            ? 'Builds'
            : countLabel('Builds', scopeCount(list, project))
        }
      />
      <NavigationDrawer.Item
        value="devices"
        label="Devices"
        style={styles.item}
        icon={deviceWarning ? icon('status-warn', true) : icon(DEVICES_ICON)}
        accessibilityLabel={
          deviceWarning ? 'Devices. See the warning.' : 'Devices'
        }
      />
      {devices.kind === 'ok' &&
        sidebarDevices(devices.value.devices).map((device) => (
          <NavigationDrawer.Item
            key={device.value}
            value={device.value}
            label={device.label}
            style={styles.device}
            icon={() => (
              <View
                style={[
                  styles.dotSlot,
                  { width: ICON_SIZE, height: ICON_SIZE },
                ]}
              >
                <View
                  style={[
                    styles.dot,
                    device.ready
                      ? { backgroundColor: colors.primary }
                      : { borderWidth: 2, borderColor: colors.error },
                  ]}
                />
              </View>
            )}
            accessibilityLabel={device.accessibilityLabel}
          />
        ))}
      <NavigationDrawer.Item
        value="setup"
        label="Setup"
        style={styles.item}
        icon={icon(setup.icon, setup.problems > 0)}
        badge={setup.problems > 0 ? setup.problems : undefined}
        accessibilityLabel={setup.accessibilityLabel}
      />
      {list !== undefined && (
        <View style={styles.store}>
          <Typography variant="labelMedium" color={colors.onSurfaceVariant}>
            Store
          </Typography>
          <Typography
            variant="bodySmall"
            color={colors.onSurfaceVariant}
            style={MONO_WRAP}
            selectable
          >
            {list.store}
          </Typography>
        </View>
      )}
    </>
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
  const choices = switchChoices(counts, project)
  const canSwitch = choices.projects.length > 0 || choices.all
  const name = project ?? ALL_PROJECTS
  const pick = (next: string | undefined) => {
    setOpen(false)
    onProject(next)
  }
  return (
    <View style={styles.switcher}>
      <Card
        variant="filled"
        containerColor={colors.secondaryContainer}
        onPress={canSwitch ? () => setOpen(true) : undefined}
        accessibilityLabel={canSwitch ? `${name}. Change the project` : name}
        accessibilityState={canSwitch ? { expanded: open } : undefined}
      >
        <View style={styles.switcherRow}>
          <ProjectAvatar project={project} size="small" />
          <Typography
            variant="titleSmall"
            color={colors.onSecondaryContainer}
            numberOfLines={2}
            style={styles.switcherName}
          >
            {name}
          </Typography>
          {canSwitch && (
            <Icon
              source={SWAP_ICON}
              size={ICON_SIZE}
              color={colors.onSecondaryContainer}
            />
          )}
        </View>
      </Card>
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
            <Tooltip
              key={choice}
              side="bottom"
              anchor={
                <ProjectAvatar
                  project={choice}
                  size="medium"
                  onPress={() => pick(choice)}
                  accessibilityLabel={countLabel(choice, count)}
                />
              }
            >
              {choice}
            </Tooltip>
          ))}
          {choices.all && (
            <Tooltip
              side="bottom"
              anchor={
                <ProjectAvatar
                  project={undefined}
                  size="medium"
                  onPress={() => pick(undefined)}
                  accessibilityLabel={ALL_PROJECTS}
                />
              }
            >
              {ALL_PROJECTS}
            </Tooltip>
          )}
        </View>
      </Menu>
    </View>
  )
}

/** The initials of a project on its color, or the grid for all projects. */
function ProjectAvatar({
  project,
  size,
  onPress,
  accessibilityLabel,
}: {
  project: string | undefined
  size: 'small' | 'medium'
  onPress?: () => void
  accessibilityLabel?: string
}) {
  const { colors } = useTheme()
  const { scheme } = useThemeMode()
  if (project === undefined) {
    return (
      <Avatar
        icon={ALL_ICON}
        size={size}
        containerColor={colors.surfaceContainerHighest}
        contentColor={colors.onSurfaceVariant}
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
      />
    )
  }
  const tones = AVATAR_TONES[scheme]
  const tone = tones[projectTone(project, tones.length)]
  return (
    <Avatar
      label={projectInitials(project)}
      size={size}
      containerColor={tone?.container}
      contentColor={tone?.content}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
    />
  )
}
