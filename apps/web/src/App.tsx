import { AppBar } from '@rootnative/components/appbar'
import { Button } from '@rootnative/components/button'
import { Container, Grid, Layout } from '@rootnative/components/layout'
import { ThemeProvider, darkTheme, lightTheme } from '@rootnative/core'
import { useEffect, useState } from 'react'
import { ScrollView } from 'react-native'
import { NO_TOKEN } from './api/client'
import type { BuildList, DeviceReport } from './api/types'
import { useApi } from './api/useApi'
import { BuildsSection } from './components/BuildsSection'
import { DevicesSection } from './components/DevicesSection'
import { Notice } from './components/Notice'
import { TOKEN_KEY, resolveToken } from './logic/token'

const TITLE = 'RootNative DevHub'

export function App() {
  const [token] = useState(takeToken)
  return (
    <ThemeProvider theme={{ light: lightTheme, dark: darkTheme }}>
      <Layout>
        {token === undefined ? (
          <>
            <AppBar title={TITLE} />
            <Container width="large" p="lg">
              <Notice tone="error">{NO_TOKEN}</Notice>
            </Container>
          </>
        ) : (
          <Dashboard token={token} />
        )}
      </Layout>
    </ThemeProvider>
  )
}

function Dashboard({ token }: { token: string }) {
  const builds = useApi<BuildList>('/api/builds', token)
  const devices = useApi<DeviceReport>('/api/devices', token)
  const reloadDevices = devices.reload

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
  }

  return (
    <>
      <AppBar
        title={TITLE}
        subtitle="Stored builds and devices"
        trailing={
          <Button
            variant="text"
            loading={builds.busy || devices.busy}
            onPress={refresh}
          >
            Refresh
          </Button>
        }
      />
      <ScrollView>
        <Container width="large" p="lg">
          <Grid columns={{ compact: 1, expanded: 3 }} gap="lg">
            <Grid.Cell span={1}>
              <DevicesSection state={devices.state} />
            </Grid.Cell>
            <Grid.Cell span={{ compact: 1, expanded: 2 }}>
              <BuildsSection state={builds.state} now={new Date()} />
            </Grid.Cell>
          </Grid>
        </Container>
      </ScrollView>
    </>
  )
}

/**
 * Takes the token from the URL fragment that devhub ui printed, keeps it in
 * sessionStorage, and removes it from the address bar.
 */
function takeToken(): string | undefined {
  let stored: string | null = null
  try {
    stored = window.sessionStorage.getItem(TOKEN_KEY)
  } catch {
    // The browser can block storage. The token then lives in memory only.
  }
  const { token, fromHash } = resolveToken(window.location.hash, stored)
  if (fromHash && token !== undefined) {
    try {
      window.sessionStorage.setItem(TOKEN_KEY, token)
    } catch {
      // The browser can block storage. A reload then needs the URL again.
    }
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search,
    )
  }
  return token
}
