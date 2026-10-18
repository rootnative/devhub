// Copies the web export of apps/web into dist/ui/, so the package ships the
// page of `devhub ui`. Turbo runs the web export first (turbo.json).
import { cp, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const source = path.join(packageDir, '..', '..', 'apps', 'web', 'dist')
const target = path.join(packageDir, 'dist', 'ui')

try {
  await stat(path.join(source, 'index.html'))
} catch {
  console.error(
    `The page of devhub ui is not built: ${path.join(source, 'index.html')} does not exist. Run "pnpm run build" in the root folder of the repository.`,
  )
  process.exit(1)
}
await rm(target, { recursive: true, force: true })
await cp(source, target, { recursive: true })
