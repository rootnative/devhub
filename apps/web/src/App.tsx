import { Button } from '@rootnative/components/button'
import { Dialog } from '@rootnative/components/dialog'
import { IconButton } from '@rootnative/components/icon-button'
import { Container, Grid, Layout, Row } from '@rootnative/components/layout'
import { PortalHost } from '@rootnative/components/portal'
import { SnackbarProvider, useSnackbar } from '@rootnative/components/snackbar'
import { Tooltip } from '@rootnative/components/tooltip'
import { Typography } from '@rootnative/components/typography'
import { ThemeProvider, useBreakpointValue, useTheme } from '@rootnative/core'
import { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'
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
import { Notice } from './components/Notice'
import { SetupSection, type DoctorState } from './components/SetupSection'
import { SyncCard, type SyncState } from './components/SyncCard'
import { SyncControls } from './components/SyncControls'
import { TitleBar } from './components/TitleBar'
import { HOST_KEY, resolveHost, type Host } from './logic/host'
import { installedMessage } from './logic/install'
import { TOKEN_KEY, resolveToken } from './logic/token'
import { storeLine, type BuildRow } from './logic/view'
import { easStatus } from './logic/whoami'
import { iconResolver, type IconName } from './icons'
import { darkTheme, lightTheme } from './theme'

const TITLE = 'DevHub'
const REFRESH_ICON: IconName = 'refresh'
const REFRESH_HINT = 'Read the builds, the devices, and the EAS status again.'

export function App() {
  const [{ token, host }] = useState(takeSession)
  return (
    <ThemeProvider
      theme={{ light: lightTheme, dark: darkTheme }}
      iconResolver={iconResolver}
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
  )
}

function Dashboard({ token, host }: { token: string; host: Host }) {
  const { colors } = useTheme()
  const snackbar = useSnackbar()
  const builds = useApi<BuildList>('/api/builds', token)
  const devices = useApi<DeviceReport>('/api/devices', token)
  // One eas-cli call on load, the one network call the page makes by itself.
  const eas = useApi<WhoamiReport>('/api/whoami', token)
  const reloadDevices = devices.reload
  const [installing, setInstalling] = useState<string>()
  // The message stays while the dialog runs its exit animation.
  const [failure, setFailure] = useState({ visible: false, message: '' })
  const [sync, setSync] = useState<SyncState>({ kind: 'idle' })
  const [checks, setChecks] = useState<DoctorState>({ running: false })
  // Below the expanded breakpoint, the EAS chip and Sync do not fit next to
  // the title, so they go above the sections.
  const wide = useBreakpointValue({ compact: false, expanded: true })

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

  // The request returns when the sync ends, which can take minutes. The
  // server holds the sync lock, so a sync from the CLI or from a second tab
  // gets the lock message.
  const runSync = async () => {
    setSync({ kind: 'running' })
    const result = await postJson<SyncReport>('/api/sync', token, {})
    setSync({ kind: 'done', result })
    void builds.reload()
    // A sync that eas-cli refused, for example after a logout, changes the
    // login state.
    if (result.kind === 'error') {
      void eas.reload()
    }
  }

  // The checks run on a click only. The EAS check calls eas-cli, and the page
  // load makes one eas-cli call already.
  const runChecks = async () => {
    setChecks((current) => ({ ...current, running: true }))
    const result = await getJson<DoctorReport>('/api/doctor', token)
    setChecks({ running: false, result })
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
      snackbar.show({ message: installedMessage(row.shortId, device) })
    } else {
      setFailure({ visible: true, message: result.message })
    }
  }

  const syncControls = (
    <SyncControls
      eas={easStatus(eas.state)}
      syncing={sync.kind === 'running'}
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

  return (
    <>
      <TitleBar
        host={host}
        title={TITLE}
        subtitle={storeLine(builds.state)}
        trailing={
          wide ? (
            <Row gap="sm" align="center">
              {syncControls}
              {refreshButton}
            </Row>
          ) : (
            refreshButton
          )
        }
      />
      <ScrollView>
        <Container width="large" p="lg">
          {!wide && <Row pb="lg">{syncControls}</Row>}
          {/* The build table needs the width. From the large breakpoint,
              the devices and the setup go in a side column at the end.
              Below it, they go under the builds. */}
          <Grid columns={{ compact: 1, large: 4 }} gap="lg">
            <Grid.Cell span={{ compact: 1, large: 3 }}>
              <BuildsSection
                state={builds.state}
                now={new Date()}
                devices={
                  devices.state.kind === 'ok'
                    ? devices.state.value.devices
                    : undefined
                }
                installing={installing}
                onInstall={(row, device) => void install(row, device)}
                syncResult={
                  <SyncCard
                    state={sync}
                    onClose={() => setSync({ kind: 'idle' })}
                  />
                }
              />
            </Grid.Cell>
            <Grid.Cell span={1}>
              <Grid columns={{ compact: 1, medium: 2, large: 1 }} gap="xl">
                <DevicesSection state={devices.state} />
                <SetupSection state={checks} onRun={() => void runChecks()} />
              </Grid>
            </Grid.Cell>
          </Grid>
        </Container>
      </ScrollView>
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
