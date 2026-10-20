import { app, BrowserWindow, dialog, shell } from 'electron'
import { devhubBin, startUiChild, type UiChild } from './child'
import { decideNavigation } from './navigation'

app.enableSandbox()

let child: UiChild | undefined
let stopping = false

app.whenReady().then(start, (error: unknown) => fail(String(error)))

app.on('window-all-closed', () => {
  app.quit()
})

// The child waits while a sync or an install runs, the same as after Ctrl+C
// on `devhub ui`. The app quits when the child has exited.
app.on('before-quit', (event) => {
  if (child === undefined || child.exited()) {
    return
  }
  event.preventDefault()
  if (stopping) {
    return
  }
  stopping = true
  process.stderr.write('Stopping devhub ui.\n')
  child.process.once('exit', () => app.quit())
  if (!child.process.kill()) {
    app.quit()
  }
})

async function start(): Promise<void> {
  child = startUiChild(devhubBin(), process.env)
  let url: string
  try {
    url = (await child.announcement).url
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error))
    return
  }
  const stderrAtStart = child.stderr()
  child.process.on('exit', (code) => {
    if (!stopping) {
      fail(
        `devhub ui exited with code ${code}.\n\n${child?.stderr().slice(stderrAtStart.length).trim() ?? ''}`,
      )
    }
  })
  openWindow(url)
}

function openWindow(url: string): void {
  const window = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 640,
    minHeight: 480,
    show: false,
    title: 'DevHub by Root Native',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })
  window.once('ready-to-show', () => window.show())
  window.webContents.on('will-navigate', (event, target) => {
    const decision = decideNavigation(url, target)
    if (decision === 'allow') {
      return
    }
    event.preventDefault()
    if (decision === 'external') {
      void shell.openExternal(target)
    }
  })
  window.webContents.setWindowOpenHandler(({ url: target }) => {
    if (decideNavigation(url, target) === 'external') {
      void shell.openExternal(target)
    }
    return { action: 'deny' }
  })
  void window.loadURL(url)
}

function fail(message: string): void {
  dialog.showErrorBox('DevHub cannot start', message)
  app.quit()
}
