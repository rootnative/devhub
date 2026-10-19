// Runs `expo` or `devhub` with DEVHUB_HOME set to .devhub/ in this folder.
// A test build then never goes into the store of the developer, and a check
// of the store shows only the builds of this app.
//
// The bin files run with `node`, not through a shell, because `expo` and
// `devhub` are `.cmd` files on Windows, and a shell can split an argument
// with a space in it, for example `--device "Test Phone"`.
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(root, 'package.json'))

const bins = {
  expo: () => require.resolve('expo/bin/cli'),
  devhub: () => {
    const manifest = require.resolve('@rootnative/devhub/package.json')
    const { bin } = JSON.parse(readFileSync(manifest, 'utf8'))
    return path.join(path.dirname(manifest), bin.devhub)
  },
}

const [name, ...args] = process.argv.slice(2)
if (!Object.hasOwn(bins, name ?? '')) {
  console.error('Usage: node with-store.mjs <expo|devhub> [arguments]')
  process.exit(2)
}

try {
  require.resolve('@rootnative/devhub/cache-provider')
} catch {
  console.error(
    'The build of @rootnative/devhub is missing. Run `pnpm run build` in the root folder of the repository, then try again.',
  )
  process.exit(1)
}

const child = spawn(process.execPath, [bins[name](), ...args], {
  stdio: 'inherit',
  env: { ...process.env, DEVHUB_HOME: path.join(root, '.devhub') },
})

// The terminal sends Ctrl+C to the child too. Wait until the child stops,
// so Expo CLI can stop Metro first.
process.on('SIGINT', () => {})
process.on('SIGTERM', () => child.kill('SIGTERM'))

child.on('error', (error) => {
  console.error(`Cannot start ${name}: ${error.message}`)
  process.exit(1)
})
child.on('exit', (code) => process.exit(code ?? 1))
