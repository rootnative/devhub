// Starts Electron with the built main process. A terminal of VS Code sets
// ELECTRON_RUN_AS_NODE=1, and with it Electron runs as plain Node and the
// app cannot import "electron". The script removes it for the child.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const electron = require('electron')

if (!existsSync(electron)) {
  console.error(
    `The Electron binary is missing at ${electron}. Run "node node_modules/electron/install.js" in the repository root, and then start again.`,
  )
  process.exit(1)
}

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(electron, [app, ...process.argv.slice(2)], {
  env,
  stdio: 'inherit',
})
child.on('exit', (code) => process.exit(code ?? 1))
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}
