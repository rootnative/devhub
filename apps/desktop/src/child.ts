import { createRequire } from 'node:module'
import path from 'node:path'
import { utilityProcess, type UtilityProcess } from 'electron'
import { readAnnouncement, type UiAnnouncement } from './announcement'

/**
 * The `devhub` bin of the `@rootnative/devhub` that the app bundles. The
 * app never uses a global `devhub`, because a different version can give
 * different JSON.
 */
export function devhubBin(): string {
  const require = createRequire(import.meta.url)
  const packageJson = require.resolve('@rootnative/devhub/package.json')
  return path.join(path.dirname(packageJson), 'dist', 'bin.js')
}

export type UiChild = {
  process: UtilityProcess
  /** Resolves with the URL of the page, or rejects when the child exits first. */
  announcement: Promise<UiAnnouncement>
  /** The stderr text so far. The app shows it only as text. */
  stderr: () => string
  /** `true` after the child exited. */
  exited: () => boolean
}

/**
 * Starts `devhub ui --no-open --json` as a child of the app, with the
 * Electron utility process. The child is a Node process with the bundled
 * Node of Electron, and no `ELECTRON_RUN_AS_NODE`.
 */
export function startUiChild(bin: string, env: NodeJS.ProcessEnv): UiChild {
  const child = utilityProcess.fork(bin, ['ui', '--no-open', '--json'], {
    stdio: 'pipe',
    serviceName: 'devhub ui',
    env,
  })
  let stdout = ''
  let stderr = ''
  let exited = false

  const announcement = new Promise<UiAnnouncement>((resolve, reject) => {
    let done = false
    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
      if (done) {
        return
      }
      const found = readAnnouncement(stdout)
      if (found !== undefined) {
        done = true
        resolve(found)
      }
    })
    child.on('exit', (code) => {
      exited = true
      if (!done) {
        done = true
        reject(new Error(exitMessage(code, stderr)))
      }
    })
  })
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString()
    process.stderr.write(chunk)
  })

  return {
    process: child,
    announcement,
    stderr: () => stderr,
    exited: () => exited,
  }
}

function exitMessage(code: number, stderr: string): string {
  const text = stderr.trim()
  return `devhub ui exited with code ${code} before it gave its URL.${text === '' ? '' : `\n\n${text}`}`
}
