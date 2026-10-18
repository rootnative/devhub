#!/usr/bin/env node
/**
 * Checks the built package and the files that its tarball holds. The other
 * checks read the source. A fault here shows only after a user installs the
 * package:
 *
 *   - A path in `exports` or `bin` with no file behind it.
 *   - A bin with no `#!/usr/bin/env node` line, which a global install
 *     cannot run.
 *   - No page in `dist/ui/`, or a page whose script is not in the tarball.
 *     Then `devhub ui` serves an empty page.
 *   - No `llms.txt`, README, LICENSE, or CHANGELOG.
 *   - A test file in the tarball.
 *   - A runtime dependency on a `@rootnative` package. Only the built page
 *     uses one, and the build copies that page into `dist/ui/`.
 *
 * Run it after `pnpm run build`. CI and both release workflows run it, so
 * the check on a pull request is the check before a publish.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageDir = join(repoRoot, 'packages', 'devhub')
const manifest = JSON.parse(
  readFileSync(join(packageDir, 'package.json'), 'utf8'),
)

const problems = []
const fail = (message) => problems.push(message)

function manifestPaths(node, out = new Set()) {
  if (typeof node === 'string') {
    if (node.startsWith('./')) {
      out.add(node.slice(2))
    }
  } else if (node !== null && typeof node === 'object') {
    for (const value of Object.values(node)) {
      manifestPaths(value, out)
    }
  }
  return out
}

function pageAssets() {
  const page = join(packageDir, 'dist', 'ui', 'index.html')
  if (!existsSync(page)) {
    fail(
      'packages/devhub/dist/ui/index.html does not exist. Run "pnpm run build" in the root folder, so Turbo exports the page first.',
    )
    return []
  }
  const html = readFileSync(page, 'utf8')
  const assets = []
  for (const match of html.matchAll(/\b(?:src|href)="\/([^"]+)"/g)) {
    assets.push(`dist/ui/${match[1]}`)
  }
  if (assets.length === 0) {
    fail('packages/devhub/dist/ui/index.html loads no script.')
  }
  return assets
}

const binPaths = manifestPaths(manifest.bin)
const required = [
  'package.json',
  ...manifestPaths(manifest.exports),
  ...binPaths,
  'dist/ui/index.html',
  ...pageAssets(),
  'llms.txt',
  'README.md',
  'LICENSE',
  'CHANGELOG.md',
]

for (const bin of binPaths) {
  const file = join(packageDir, bin)
  if (
    existsSync(file) &&
    !readFileSync(file, 'utf8').startsWith('#!/usr/bin/env node\n')
  ) {
    fail(`${bin} does not start with "#!/usr/bin/env node".`)
  }
}

for (const field of ['dependencies', 'peerDependencies']) {
  for (const name of Object.keys(manifest[field] ?? {})) {
    if (name.startsWith('@rootnative/')) {
      fail(
        `${field} names ${name}. The package must not depend on a @rootnative package. The page bundles what it uses.`,
      )
    }
  }
}

let packed
try {
  // `--ignore-scripts` stops `prepack`, so the check reads the build that is
  // on disk, and the build log does not mix with the JSON. On Windows, npm
  // is a .cmd file, which Node runs only through a shell. The arguments are
  // fixed, so the shell cannot change them.
  const raw = execFileSync(
    'npm',
    ['pack', '--dry-run', '--ignore-scripts', '--json'],
    {
      cwd: packageDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    },
  )
  packed = JSON.parse(raw)[0].files.map((file) => file.path)
} catch (error) {
  fail(`"npm pack --dry-run" failed: ${error.message}`)
}

if (packed !== undefined) {
  for (const path of required) {
    if (!packed.includes(path)) {
      fail(
        `${path} is not in the tarball. Check "files", "exports", and "bin" in packages/devhub/package.json, and run "pnpm run build".`,
      )
    }
  }
  const tests = packed.filter(
    (path) => path.includes('__tests__') || /\.test\./.test(path),
  )
  if (tests.length > 0) {
    fail(`The tarball holds test files: ${tests.join(', ')}.`)
  }
}

const prefix = process.env.GITHUB_ACTIONS === 'true' ? '::error::' : 'ERROR  '
for (const problem of problems) {
  console.error(`${prefix}${problem}`)
}
if (problems.length > 0) {
  console.error(`\n[check-artifact] ${problems.length} problem(s).`)
  process.exit(1)
}
console.log(
  `[check-artifact] ok: the tarball holds ${packed.length} files, the page and llms.txt among them.`,
)
