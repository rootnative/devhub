#!/usr/bin/env node
/**
 * Builds packages/devhub/llms.txt. The file ships in the package, so an AI
 * agent can read the CLI and the JSON of the installed version from
 * node_modules, and not a page about a different version.
 *
 * scripts/llms.template.md is the source, written by hand. This script fills
 * its placeholders from the build, so the parts that change with the code
 * cannot go out of date:
 *
 *   {{version}}  the version in packages/devhub/package.json
 *   {{cli}}      the help of devhub and of each command, from dist/bin.js
 *   {{json}}     the type of each --json output, from dist/index.d.ts
 *   {{exports}}  the names of the core API, from dist/index.d.ts
 *
 * Run `pnpm run build` first. `--check` writes nothing, and exits with 1 when
 * llms.txt is not the text that this script makes. CI runs the check, so the
 * check and the build cannot disagree.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageDir = join(repoRoot, 'packages', 'devhub')
const templatePath = join(repoRoot, 'scripts', 'llms.template.md')
const outputPath = join(packageDir, 'llms.txt')
const binPath = join(packageDir, 'dist', 'bin.js')
const typesPath = join(packageDir, 'dist', 'index.d.ts')

// `where` and `ui` print an object that has no exported type, so the
// template gives their JSON.
const JSON_TYPES = [
  { command: 'devhub sync --json', type: 'SyncReport' },
  { command: 'devhub list --json', type: 'BuildList' },
  { command: 'devhub devices --json', type: 'DeviceReport' },
  { command: 'devhub install <id> --json', type: 'InstalledBuild' },
]

const checkOnly = process.argv.includes('--check')
const label = checkOnly ? 'check-llms' : 'build-llms'

// A Windows checkout can change LF to CRLF. The check must give the same
// result on each system.
function readText(file) {
  return readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
}

function help(args) {
  return execFileSync(process.execPath, [binPath, ...args, '--help'], {
    encoding: 'utf8',
  })
    .replace(/\r\n/g, '\n')
    .trimEnd()
}

function commandNames(mainHelp) {
  const section = mainHelp.split('\nCommands:\n')[1]
  if (section === undefined) {
    throw new Error(`[${label}] "devhub --help" has no "Commands:" section.`)
  }
  const names = []
  for (const line of section.split('\n')) {
    if (line.trim() === '') {
      break
    }
    names.push(line.trim().split(/\s+/)[0])
  }
  return names
}

function cliSection() {
  const mainHelp = help([])
  const blocks = [{ title: 'devhub', text: mainHelp }]
  for (const name of commandNames(mainHelp)) {
    blocks.push({ title: `devhub ${name}`, text: help([name]) })
  }
  return blocks
    .map(({ title, text }) => `### ${title}\n\n\`\`\`text\n${text}\n\`\`\``)
    .join('\n\n')
}

function closingQuote(source, start) {
  const quote = source[start]
  let i = start + 1
  while (i < source.length && source[i] !== quote) {
    i += source[i] === '\\' ? 2 : 1
  }
  return i
}

/**
 * Splits a declaration file into its top-level statements. Each statement
 * keeps the doc comment above it. A class body ends with `}` and no `;`, so
 * a `}` at depth 0 also ends a statement, unless the type continues after
 * it, as in `{ ... } | FlowError;`.
 */
function statements(source) {
  const result = []
  let start = 0
  let depth = 0
  let i = 0
  while (i < source.length) {
    if (source.startsWith('/*', i)) {
      i = source.indexOf('*/', i + 2) + 2
      continue
    }
    if (source.startsWith('//', i)) {
      const next = source.indexOf('\n', i)
      i = next === -1 ? source.length : next
      continue
    }
    const char = source[i]
    if (char === '"' || char === "'" || char === '`') {
      i = closingQuote(source, i) + 1
      continue
    }
    if ('{(['.includes(char)) {
      depth++
    } else if ('})]'.includes(char)) {
      depth--
    }
    i++
    const ends =
      depth === 0 &&
      (char === ';' ||
        (char === '}' && !/^\s*[;|&[.)>,]/.test(source.slice(i))))
    if (ends) {
      result.push(source.slice(start, i).trim())
      start = i
    }
  }
  return result
}

function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .trim()
}

function namedTypes(declarations) {
  const types = new Map()
  for (const statement of declarations) {
    const match = /^(?:declare\s+)?(?:type|interface)\s+(\w+)/.exec(
      stripComments(statement),
    )
    if (match) {
      types.set(match[1], statement)
    }
  }
  return types
}

function references(name, types) {
  const code = stripComments(types.get(name)).replace(
    /(['"`])(?:\\.|(?!\1).)*\1/g,
    '',
  )
  const words = new Set(code.match(/\b[A-Za-z_]\w*\b/g))
  return [...words].filter((word) => word !== name && types.has(word))
}

function jsonSection(declarations) {
  const types = namedTypes(declarations)
  const printed = new Set()
  const lines = []
  const blocks = []
  for (const { command, type } of JSON_TYPES) {
    if (!types.has(type)) {
      throw new Error(
        `[${label}] ${typesPath} has no type ${type}. Update JSON_TYPES in scripts/build-llms.mjs.`,
      )
    }
    lines.push(`- \`${command}\` prints \`${type}\`.`)
    const queue = [type]
    while (queue.length > 0) {
      const name = queue.shift()
      if (printed.has(name)) {
        continue
      }
      printed.add(name)
      blocks.push(types.get(name))
      queue.push(...references(name, types))
    }
  }
  return `${lines.join('\n')}\n\n\`\`\`ts\n${blocks.join('\n\n')}\n\`\`\``
}

function wrap(text, width = 80) {
  const lines = []
  let line = ''
  for (const word of text.split(' ')) {
    if (line !== '' && line.length + 1 + word.length > width) {
      lines.push(line)
      line = word
    } else {
      line = line === '' ? word : `${line} ${word}`
    }
  }
  lines.push(line)
  return lines.join('\n')
}

function exportsSection(declarations) {
  const statement = declarations
    .map(stripComments)
    .find((code) => code.startsWith('export {'))
  if (statement === undefined) {
    throw new Error(`[${label}] ${typesPath} has no "export { ... }".`)
  }
  const names = statement
    .slice('export {'.length, statement.lastIndexOf('}'))
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '')
  const types = names
    .filter((name) => name.startsWith('type '))
    .map((name) => name.slice('type '.length))
  const values = names.filter((name) => !name.startsWith('type '))
  return [
    wrap(`Functions, classes, and constants: ${values.join(', ')}.`),
    wrap(`Types: ${types.join(', ')}.`),
  ].join('\n\n')
}

function render() {
  const declarations = statements(readText(typesPath))
  const values = {
    version: JSON.parse(readText(join(packageDir, 'package.json'))).version,
    cli: cliSection(),
    json: jsonSection(declarations),
    exports: exportsSection(declarations),
  }
  const used = new Set()
  const output = readText(templatePath)
    .replace(/<!--[\s\S]*?-->\n*/g, '')
    .replace(/\{\{(\w+)\}\}/g, (placeholder, key) => {
      if (!Object.hasOwn(values, key)) {
        throw new Error(
          `[${label}] scripts/llms.template.md has the unknown placeholder ${placeholder}.`,
        )
      }
      used.add(key)
      return values[key]
    })
  const unused = Object.keys(values).filter((key) => !used.has(key))
  if (unused.length > 0) {
    throw new Error(
      `[${label}] scripts/llms.template.md has no {{${unused.join('}}, {{')}}}.`,
    )
  }
  return output
}

function firstDifference(current, expected) {
  const currentLines = current.split('\n')
  const expectedLines = expected.split('\n')
  let i = 0
  while (currentLines[i] === expectedLines[i]) {
    i++
  }
  return [
    `  line ${i + 1}`,
    `  in llms.txt:     ${JSON.stringify(currentLines[i] ?? '(end of file)')}`,
    `  from the build:  ${JSON.stringify(expectedLines[i] ?? '(end of file)')}`,
  ].join('\n')
}

for (const file of [binPath, typesPath]) {
  if (!existsSync(file)) {
    console.error(
      `[${label}] ${file} does not exist. Run "pnpm run build" in the root folder of the repository first.`,
    )
    process.exit(1)
  }
}

const expected = render()

if (checkOnly) {
  const current = existsSync(outputPath) ? readText(outputPath) : undefined
  if (current !== expected) {
    console.error(
      current === undefined
        ? `[check-llms] packages/devhub/llms.txt does not exist.`
        : `[check-llms] packages/devhub/llms.txt is out of date.\n${firstDifference(current, expected)}`,
    )
    console.error(
      'Run "pnpm run build" and "pnpm run build:llms", and commit packages/devhub/llms.txt.',
    )
    process.exit(1)
  }
  console.log(
    '[check-llms] ok: packages/devhub/llms.txt agrees with the build.',
  )
} else {
  writeFileSync(outputPath, expected)
  console.log('[build-llms] wrote packages/devhub/llms.txt.')
}
