#!/usr/bin/env node
/**
 * The release gate. `pnpm run preflight` checks the code. This script checks
 * the release: is a publish of this version, now, to this dist-tag, what
 * the maintainer wants? Both release workflows run it before preflight.
 *
 * Usage:
 *   node scripts/check-release.mjs --version 0.0.0-alpha.1 --dist-tag latest
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGE = '@rootnative/devhub'

// Trusted publishing needs npm 11.5.1, and `npm stage publish` needs
// 11.15.0. Both publishers on npmjs.com are stage-only.
const MIN_NPM = '11.15.0'

function arg(name) {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? undefined : process.argv[at + 1]
}

const problems = []
const warnings = []
const fail = (message) => problems.push(message)
const warn = (message) => warnings.push(message)

const requestedVersion = arg('version')
const distTag = arg('dist-tag')
if (!requestedVersion || !distTag) {
  console.error(
    'Usage: node scripts/check-release.mjs --version <version> --dist-tag <tag>',
  )
  process.exit(2)
}

/** A negative number when `a` is older than `b`. Ignores a prerelease part. */
function compareVersions(a, b) {
  const parse = (version) => version.split('-')[0].split('.').map(Number)
  const left = parse(a)
  const right = parse(b)
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0)
    if (difference !== 0) {
      return difference
    }
  }
  return 0
}

// An older npm does not try trusted publishing. It looks for a token, finds
// none, and fails with a 404 that names neither problem.
const npmVersion = execFileSync('npm', ['--version'], {
  encoding: 'utf8',
}).trim()
if (compareVersions(npmVersion, MIN_NPM) < 0) {
  fail(
    `npm ${npmVersion} cannot do a staged publish with a trusted publisher. Use npm ${MIN_NPM} or later. In CI, change the npm version in both release workflows.`,
  )
}

const manifest = JSON.parse(
  readFileSync(join(repoRoot, 'packages', 'devhub', 'package.json'), 'utf8'),
)
const version = manifest.version

if (version !== requestedVersion) {
  fail(
    `You asked for ${requestedVersion}, but packages/devhub/package.json has ${version}. The release workflows set the version. Run one of them, and do not change the version by hand.`,
  )
}

if (manifest.private === true) {
  fail(
    'packages/devhub/package.json has "private": true, so npm refuses the publish. Remove it on main, and run the release again.',
  )
}

// The checkout must have the tags, so a CI checkout uses `fetch-depth: 0`.
const tag = `devhub@${version}`
let tagExists = true
try {
  execFileSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], {
    cwd: repoRoot,
    stdio: 'ignore',
  })
} catch {
  tagExists = false
}
if (tagExists) {
  fail(
    `The tag ${tag} exists.\n` +
      `  If ${version} is on npm, npm does not accept it again. Release the next version.\n` +
      `  If it is not on npm, an earlier run pushed the tag and then failed. Delete the tag, and run the workflow again:\n` +
      `    git push --delete origin ${tag} && git tag -d ${tag}`,
  )
}

/**
 * The version that `latest` names on npm now. `null` when the package has
 * no version on npm. `undefined` when the lookup failed.
 */
function latestOnNpm() {
  try {
    const out = execFileSync('npm', ['view', PACKAGE, 'dist-tags.latest'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    return out === '' ? null : out
  } catch (error) {
    const text = `${error.stderr ?? ''}${error.message ?? ''}`
    return /E404|404 Not Found/.test(text) ? null : undefined
  }
}

// A prerelease on `latest` is correct while the alpha line is the only
// line: `npx @rootnative/devhub` resolves `latest`. It is wrong only when
// it replaces a stable version as the default install.
const isPrerelease = version.includes('-')
if (isPrerelease && distTag === 'latest') {
  const current = latestOnNpm()
  if (current === undefined) {
    fail(
      `${version} is a prerelease for "latest", and the npm lookup failed, so the check cannot tell if it replaces a stable version. Check the network, or use the "alpha" dist-tag.`,
    )
  } else if (current !== null && !current.includes('-')) {
    fail(
      `${version} is a prerelease, and it would replace the stable version ${current} on "latest". Use "alpha", "beta", or "rc".`,
    )
  } else {
    warn(
      `${version} is a prerelease for "latest". This is correct while no stable version is on npm. After the first stable version, use "alpha".`,
    )
  }
}
if (!isPrerelease && distTag !== 'latest') {
  warn(
    `${version} is a stable version for the "${distTag}" dist-tag, so "npm install ${PACKAGE}" does not install it.`,
  )
}

const inActions = process.env.GITHUB_ACTIONS === 'true'
for (const message of warnings) {
  console.error(`${inActions ? '::warning::' : 'WARN   '}${message}`)
}
for (const message of problems) {
  console.error(`${inActions ? '::error::' : 'ERROR  '}${message}`)
}
if (problems.length > 0) {
  console.error(`\n[check-release] ${problems.length} problem(s).`)
  process.exit(1)
}
console.log(
  `[check-release] ok: ${version} as ${tag} on the dist-tag ${distTag}, with npm ${npmVersion}.`,
)
