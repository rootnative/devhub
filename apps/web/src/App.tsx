import { Button } from '@rootnative/components/button'
import { Dialog } from '@rootnative/components/dialog'
import { IconButton } from '@rootnative/components/icon-button'
import { Container, Layout, Row } from '@rootnative/components/layout'
import { PortalHost } from '@rootnative/components/portal'
import { SnackbarProvider, useSnackbar } from '@rootnative/components/snackbar'
import { Tooltip } from '@rootnative/components/tooltip'
import { Typography } from '@rootnative/components/typography'
import {
  ThemeProvider,
  useBreakpointValue,
  useTheme,
  type ThemeMode,
} from '@rootnative/core'
import { Motion, MotionConfig } from '@rootnative/inertia'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { NO_TOKEN, getJson, postJson } from './api/client'
import type {
  BuildList,
  Device,
  DeviceReport,
  DoctorReport,
  InstalledBuild,
  SyncReport,
  WhoamiReport,
} from './api/types'
import { useApi } from './api/useApi'
import { BuildsSection } from './components/BuildsSection'
import { DevicesSection } from './components/DevicesSection'
import { IconTile } from './components/IconTile'
import { Notice } from './components/Notice'
import { PageHeader } from './components/PageHeader'
import { ProjectBadge } from './components/ProjectBadge'
import { SettingsDialog } from './components/SettingsDialog'
import { CheckButton, SetupSection } from './components/SetupSection'
import { ALL_PROJECTS, Sidebar, SidebarDrawer } from './components/Sidebar'
import { SummaryStrip } from './components/SummaryStrip'
import { SyncBar } from './components/SyncBar'
import { SyncControls } from './components/SyncControls'
import { SyncDetailsDialog } from './components/SyncDetailsDialog'
import { TargetPicker } from './components/TargetPicker'
import { TitleBar } from './components/TitleBar'
import type { DoctorState } from './logic/doctor'
import { HOST_KEY, resolveHost, type Host } from './logic/host'
import {
  installTargets,
  installedMessage,
  keepChosen,
  pickerView,
  type ChosenTargets,
} from './logic/install'
import {
  devicesWarning,
  keepProject,
  setupHue,
  type Page,
} from './logic/sidebar'
import { buildCells, deviceCells, setupCells } from './logic/strip'
import { buildSummary } from './logic/summary'
import { SYNCING, syncMessage, type SyncDetails } from './logic/sync'
import { NO_TINT, endTint, tintRows } from './logic/tint'
import {
  isThemeMode,
  parseThemeMode,
  themeModeCookie,
} from './logic/themeCookie'
import { TOKEN_KEY, resolveToken } from './logic/token'
import type { BuildRow } from './logic/view'
import { easStatus } from './logic/whoami'
import { iconResolver, type IconName } from './icons'
import { TINT_DURATION, TRANSITIONS, darkTheme, lightTheme } from './theme'

const TITLE = 'DevHub'
const REFRESH_ICON: IconName = 'refresh'
const REFRESH_HINT = 'Read the builds, the devices, and the EAS status again.'
const MENU_ICON: IconName = 'menu'
const MENU_LABEL = 'Show the builds, the devices, and the setup'

// The main pane is a panel inset in the frame. Its space and its border are
// part of the width budget of the build table (SIDEBAR_WIDTH).
const styles = StyleSheet.create({
  body: { flex: 1, flexDirection: 'row' },
  panel: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    overflow: 'hidden',
    marginEnd: 8,
    marginBottom: 8,
  },
  panelNarrow: { marginStart: 8 },
  main: { flex: 1 },
  page: { flex: 1 },
  toolbarControls: { minWidth: 0 },
  narrowControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
})

// ThemeProvider names a storage key, and the page keeps one value only, so
// the cookie has its own name.
const THEME_STORAGE = {
  getItem: () => readThemeMode() ?? null,
  setItem: (_key: string, value: string) => {
    if (!isThemeMode(value)) {
      return
    }
    try {
      document.cookie = themeModeCookie(value)
    } catch {
      // The browser can block cookies. The choice then lasts until the page
      // closes.
    }
  },
}

function readThemeMode(): ThemeMode | undefined {
  try {
    return parseThemeMode(document.cookie)
  } catch {
    return undefined
  }
}

export function App() {
  const [{ token, host }] = useState(takeSession)
  // Read at once, so the first paint already has the chosen mode.
  const [initialMode] = useState(readThemeMode)
  return (
    <MotionConfig reducedMotion="user" transitions={TRANSITIONS}>
      <ThemeProvider
        theme={{ light: lightTheme, dark: darkTheme }}
        iconResolver={iconResolver}
        defaultMode={initialMode ?? 'system'}
        storage={THEME_STORAGE}
      >
        <PortalHost>
          <SnackbarProvider>
            <Layout>
              {token === undefined ? (
                <>
                  <TitleBar host={host} title={TITLE} />
                  <Container width="large" p="lg">
                    <Notice tone="error">{NO_TOKEN}</Notice>
                  </Container>
                </>
              ) : (
                <Dashboard token={token} host={host} />
              )}
            </Layout>
          </SnackbarProvider>
        </PortalHost>
      </ThemeProvider>
    </MotionConfig>
  )
}

function Dashboard({ token, host }: { token: string; host: Host }) {
  const { colors, shape } = useTheme()
  const snackbar = useSnackbar()
  const builds = useApi<BuildList>('/api/builds', token)
  const devices = useApi<DeviceReport>('/api/devices', token)
  // One eas-cli call on load, the one network call the page makes by itself.
  const eas = useApi<WhoamiReport>('/api/whoami', token)
  const reloadDevices = devices.reload
  const [installing, setInstalling] = useState<string>()
  // The message stays while the dialog runs its exit animation.
  const [failure, setFailure] = useState({ visible: false, message: '' })
  const [syncing, setSyncing] = useState(false)
  // The snackbar callbacks run after a render, and read the sync state here.
  const syncingRef = useRef(false)
  const [syncDetails, setSyncDetails] = useState<{
    visible: boolean
    details?: SyncDetails
  }>({ visible: false })
  const [checks, setChecks] = useState<DoctorState>({ running: false })
  const [page, setPage] = useState<Page>('builds')
  const [selectedProject, setSelectedProject] = useState<string>()
  // In memory only: devhub ui takes a new port at each start, so the page
  // storage does not survive a restart. The auto rule covers the usual case.
  const [chosen, setChosen] = useState<ChosenTargets>({})
  const [tint, setTint] = useState(NO_TINT)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Below the expanded breakpoint, the sidebar is a modal drawer, and the EAS
  // state and Sync do not fit next to the title, so they go above the page.
  const wide = useBreakpointValue({ compact: false, expanded: true })
  if (wide && drawerOpen) {
    setDrawerOpen(false)
  }
  const list = builds.state.kind === 'ok' ? builds.state.value : undefined
  const listRef = useRef(list)
  useEffect(() => {
    listRef.current = list
  }, [list])
  const project = keepProject(selectedProject, list)
  if (project !== selectedProject) {
    setSelectedProject(project)
  }
  const deviceList =
    devices.state.kind === 'ok' ? devices.state.value.devices : undefined
  const keptChoice = keepChosen(chosen, deviceList)
  if (keptChoice !== chosen) {
    setChosen(keptChoice)
  }
  const targets = installTargets(deviceList, keptChoice)

  // The tint ends when its fade ends, so a later visit to the page does not
  // show it again.
  useEffect(() => {
    if (tint.ids.length === 0) {
      return
    }
    const timer = setTimeout(
      () => setTint((current) => endTint(current, tint.token)),
      TINT_DURATION + 200,
    )
    return () => clearTimeout(timer)
  }, [tint])

  // The device list is a snapshot. A device can start or stop while the
  // window is in the background, so a return to the window reads it again.
  useEffect(() => {
    const onFocus = () => void reloadDevices()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [reloadDevices])

  const refresh = () => {
    void builds.reload()
    void devices.reload()
    void eas.reload()
  }

  const showSyncing = () =>
    snackbar.show({
      message: SYNCING,
      duration: 'indefinite',
      showCloseIcon: true,
      replace: true,
    })

  // The builds of the project of the first new build, from the list that the
  // sync reloaded.
  const showNewBuilds = (ids: readonly string[]) => {
    const build = listRef.current?.builds.find((candidate) =>
      ids.includes(candidate.id),
    )
    setSelectedProject(
      build === undefined ? undefined : buildSummary(build).project,
    )
    setPage('builds')
    setTint((current) => tintRows(current, ids))
  }

  // The request returns when the sync ends, which can take minutes. The
  // server holds the sync lock, so a sync from the CLI or from a second tab
  // gets the lock message.
  const runSync = async () => {
    syncingRef.current = true
    setSyncing(true)
    showSyncing()
    const result = await postJson<SyncReport>('/api/sync', token, {})
    syncingRef.current = false
    setSyncing(false)
    void builds.reload()
    // A sync that eas-cli refused, for example after a logout, changes the
    // login state.
    if (result.kind === 'error') {
      void eas.reload()
    }
    const { message, added, details } = syncMessage(result)
    if (added.length > 0) {
      setTint((current) => tintRows(current, added))
    }
    if (details !== undefined) {
      snackbar.show({
        message,
        replace: true,
        actionLabel: 'Details',
        showCloseIcon: true,
        onAction: () => setSyncDetails({ visible: true, details }),
      })
    } else if (added.length > 0) {
      snackbar.show({
        message,
        replace: true,
        duration: 'long',
        actionLabel: 'Show',
        onAction: () => showNewBuilds(added),
      })
    } else {
      snackbar.show({ message, replace: true })
    }
  }

  // The checks run on a click only. The EAS check calls eas-cli, and the page
  // load makes one eas-cli call already.
  const runChecks = async () => {
    setChecks((current) => ({ ...current, running: true }))
    const result = await getJson<DoctorReport>('/api/doctor', token)
    setChecks({ running: false, result, checkedAt: new Date() })
  }

  const install = async (row: BuildRow, device: Device) => {
    setInstalling(row.id)
    const result = await postJson<InstalledBuild>('/api/install', token, {
      id: row.id,
      device: device.id,
    })
    setInstalling(undefined)
    void devices.reload()
    if (result.kind === 'ok') {
      snackbar.show({
        message: installedMessage(row.shortId, device),
        replace: true,
        // During a sync, this message takes the place of "Syncing" for its
        // time, and "Syncing" comes back after it.
        onDismiss: (reason) => {
          if (reason !== 'replaced' && syncingRef.current) {
            showSyncing()
          }
        },
      })
    } else {
      setFailure({ visible: true, message: result.message })
    }
  }

  const targetPicker = (
    <TargetPicker
      picker={pickerView(deviceList, targets)}
      align={wide ? 'end' : 'start'}
      onSelect={(device) =>
        setChosen((current) => ({ ...current, [device.platform]: device.id }))
      }
    />
  )
  const syncControls = (
    <SyncControls
      eas={easStatus(eas.state)}
      syncing={syncing}
      onSync={() => void runSync()}
    />
  )
  const refreshing = builds.busy || devices.busy || eas.busy
  const refreshButton = (
    <Tooltip
      side="bottom"
      align="end"
      anchor={
        <IconButton
          variant="standard"
          size="extraSmall"
          shape="square"
          icon={REFRESH_ICON}
          disabled={refreshing}
          onPress={refresh}
          accessibilityLabel="Refresh"
          accessibilityHint={REFRESH_HINT}
        />
      }
    >
      {REFRESH_HINT}
    </Tooltip>
  )

  const menuButton = (
    <Tooltip
      side="bottom"
      align="start"
      anchor={
        <IconButton
          variant="standard"
          size="extraSmall"
          shape="square"
          icon={MENU_ICON}
          onPress={() => setDrawerOpen(true)}
          accessibilityLabel={MENU_LABEL}
        />
      }
    >
      {MENU_LABEL}
    </Tooltip>
  )
  const sidebar = {
    page,
    onPage: (next: Page) => {
      setPage(next)
      setDrawerOpen(false)
    },
    project,
    onProject: (next: string | undefined) => {
      setSelectedProject(next)
      setPage('builds')
      setDrawerOpen(false)
    },
    builds: builds.state,
    devices: devices.state,
    targets,
    checks,
    settingsOpen,
    onSettings: () => {
      setDrawerOpen(false)
      setSettingsOpen(true)
    },
  }

  const now = new Date()
  const header: {
    leading: ReactNode
    title: string
    subtitle?: string
    trailing?: ReactNode
  } =
    page === 'builds'
      ? {
          leading: <ProjectBadge project={project} size={20} />,
          title: project ?? ALL_PROJECTS,
          subtitle: 'Builds',
        }
      : page === 'devices'
        ? {
            leading: (
              <IconTile
                icon="device-virtual"
                hue={devicesWarning(devices.state) ? 'red' : 'blue'}
              />
            ),
            title: 'Devices',
          }
        : {
            leading: (
              <IconTile icon="setup-check" hue={setupHue(checks.result)} />
            ),
            title: 'Setup',
            trailing: (
              <CheckButton state={checks} onRun={() => void runChecks()} />
            ),
          }
  const cells =
    page === 'builds'
      ? list === undefined
        ? undefined
        : buildCells(list, project, now)
      : page === 'devices'
        ? devices.state.kind === 'ok'
          ? deviceCells(devices.state.value)
          : undefined
        : setupCells(checks)

  return (
    <>
      <TitleBar
        host={host}
        title={TITLE}
        leading={wide ? undefined : menuButton}
        trailing={
          wide ? (
            <Row gap="sm" align="center" style={styles.toolbarControls}>
              {targetPicker}
              {syncControls}
              {refreshButton}
            </Row>
          ) : (
            refreshButton
          )
        }
      />
      <View
        style={[styles.body, { backgroundColor: colors.surfaceContainerLow }]}
      >
        {wide && <Sidebar {...sidebar} />}
        <View
          style={[
            styles.panel,
            !wide && styles.panelNarrow,
            {
              backgroundColor: colors.surfaceContainerLowest,
              borderColor: colors.outlineVariant,
              borderRadius: shape.cornerMedium,
            },
          ]}
        >
          {/* A new page fades in, and the old page goes at once: two pages
              must not share the panel. */}
          <Motion.View
            key={`${page}:${project ?? ''}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition="fade"
            style={styles.page}
          >
            <PageHeader {...header} />
            {cells !== undefined && <SummaryStrip cells={cells} />}
            <ScrollView style={styles.main}>
              {!wide && (
                <View style={styles.narrowControls}>
                  {targetPicker}
                  {syncControls}
                </View>
              )}
              {page === 'builds' && (
                <BuildsSection
                  state={builds.state}
                  project={project}
                  now={now}
                  devices={deviceList}
                  targets={targets}
                  tint={tint}
                  installing={installing}
                  onInstall={(row, device) => void install(row, device)}
                />
              )}
              {page === 'devices' && <DevicesSection state={devices.state} />}
              {page === 'setup' && <SetupSection state={checks} />}
            </ScrollView>
          </Motion.View>
          <SyncBar visible={syncing} />
        </View>
      </View>
      {!wide && (
        <SidebarDrawer
          {...sidebar}
          visible={drawerOpen}
          onDismiss={() => setDrawerOpen(false)}
        />
      )}
      <SettingsDialog
        visible={settingsOpen}
        onDismiss={() => setSettingsOpen(false)}
        store={list?.store}
      />
      <SyncDetailsDialog
        visible={syncDetails.visible}
        details={syncDetails.details}
        onDismiss={() =>
          setSyncDetails((current) => ({ ...current, visible: false }))
        }
      />
      <Dialog
        visible={failure.visible}
        onDismiss={() => setFailure({ ...failure, visible: false })}
        role="alertdialog"
      >
        <Dialog.Title>The install failed</Dialog.Title>
        <Dialog.Content>
          <Typography
            variant="bodyMedium"
            color={colors.onSurfaceVariant}
            selectable
          >
            {failure.message}
          </Typography>
        </Dialog.Content>
        <Dialog.Actions>
          <Button
            variant="text"
            onPress={() => setFailure({ ...failure, visible: false })}
          >
            Close
          </Button>
        </Dialog.Actions>
      </Dialog>
    </>
  )
}

/**
 * Takes the token and the host from the URL fragment that devhub ui printed,
 * keeps them in sessionStorage, and removes them from the address bar.
 */
function takeSession(): { token: string | undefined; host: Host } {
  let storedToken: string | null = null
  let storedHost: string | null = null
  try {
    storedToken = window.sessionStorage.getItem(TOKEN_KEY)
    storedHost = window.sessionStorage.getItem(HOST_KEY)
  } catch {
    // The browser can block storage. The token then lives in memory only.
  }
  const hash = window.location.hash
  const { token, fromHash } = resolveToken(hash, storedToken)
  const host = resolveHost(hash, storedHost)
  if (fromHash && token !== undefined) {
    try {
      window.sessionStorage.setItem(TOKEN_KEY, token)
      window.sessionStorage.setItem(HOST_KEY, host)
    } catch {
      // The browser can block storage. A reload then needs the URL again.
    }
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search,
    )
  }
  return { token, host }
}
