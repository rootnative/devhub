#!/usr/bin/env node
/**
 * Writes the release files for a version that the release workflow set in
 * packages/devhub/package.json. Both release workflows run it after the
 * version bump, and before the build of llms.txt.
 *
 *   packages/devhub/CHANGELOG.md  The entries under "## [Unreleased]" move to
 *                                 "## [<version>] - <date>", and the links at
 *                                 the end name the new tag.
 *   README.md                     The version in the "Status" line.
 *   packages/devhub/README.md     The version in the "Status" line.
 *
 * A person writes the entries under "## [Unreleased]" before the release.
 * The script stops when there are none, so a version never ships with no
 * release notes.
 *
 * Usage:
 *   node scripts/prepare-release.mjs --version 0.0.0-alpha.1 [--date 2026-10-20] [--root <dir>]
 *
 * `--date` defaults to the date in UTC. `--root` is for a test on a copy.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = 'https://github.com/rootnative/devhub'

function arg(name) {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? undefined : process.argv[at + 1]
}

const version = arg('version')
const date = arg('date') ?? new Date().toISOString().slice(0, 10)
const root = resolve(
  arg('root') ?? join(dirname(fileURLToPath(import.meta.url)), '..'),
)

if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(
    'Usage: node scripts/prepare-release.mjs --version <x.y.z[-pre.n]> [--date YYYY-MM-DD]',
  )
  process.exit(2)
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`[prepare-release] The date "${date}" is not YYYY-MM-DD.`)
  process.exit(2)
}

const problems = []

// A Windows checkout can change LF to CRLF. The script writes LF.
const read = (file) =>
  readFileSync(join(root, file), 'utf8').replace(/\r\n/g, '\n')
const write = (file, text) => writeFileSync(join(root, file), text)

function changelog(text) {
  const tag = `devhub@${version}`
  const unreleased = '## [Unreleased]\n'
  const start = text.indexOf(unreleased)
  if (start === -1) {
    problems.push('CHANGELOG.md has no "## [Unreleased]" heading.')
    return text
  }
  if (text.includes(`## [${version}]`)) {
    problems.push(`CHANGELOG.md has a "## [${version}]" section already.`)
    return text
  }
  const bodyStart = start + unreleased.length
  const next = text.indexOf('\n## [', bodyStart)
  const bodyEnd = next === -1 ? text.length : next + 1
  const body = text.slice(bodyStart, bodyEnd).trim()
  if (body === '') {
    problems.push(
      'CHANGELOG.md has no entries under "## [Unreleased]". Write the release notes there, commit them to main, and run the release again.',
    )
    return text
  }

  let out =
    text.slice(0, bodyStart) +
    `\n## [${version}] - ${date}\n\n${body}\n\n` +
    text.slice(bodyEnd)

  const link = /^\[unreleased\]: .*$/m
  if (!link.test(out)) {
    problems.push('CHANGELOG.md has no "[unreleased]:" link at the end.')
    return text
  }
  out = out.replace(
    link,
    `[unreleased]: ${REPO}/compare/${tag}...HEAD\n` +
      `[${version}]: ${REPO}/releases/tag/${tag}`,
  )
  return out
}

function statusLine(file, text) {
  const status = /^(> \*\*Status:\*\* `)([^`]+)(`)/m
  if (!status.test(text)) {
    problems.push(`${file} has no "> **Status:** \`<version>\`" line.`)
    return text
  }
  return text.replace(status, `$1${version}$3`)
}

const files = {
  'packages/devhub/CHANGELOG.md': changelog,
  'README.md': (text) => statusLine('README.md', text),
  'packages/devhub/README.md': (text) =>
    statusLine('packages/devhub/README.md', text),
}

const results = Object.entries(files).map(([file, change]) => [
  file,
  change(read(file)),
])

if (problems.length > 0) {
  const inActions = process.env.GITHUB_ACTIONS === 'true'
  for (const message of problems) {
    console.error(`${inActions ? '::error::' : 'ERROR  '}${message}`)
  }
  console.error(`\n[prepare-release] ${problems.length} problem(s).`)
  process.exit(1)
}

// Write only after each file passed, so a failure changes no file.
for (const [file, text] of results) {
  write(file, text)
}
console.log(
  `[prepare-release] ok: ${version} on ${date}. Wrote ${Object.keys(files).join(', ')}.`,
)
