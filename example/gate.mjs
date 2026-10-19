// Runs the steps of README.md with no person at the device, and checks the
// output of Expo CLI and the store after each run. The cache provider gate
// workflow calls it. It needs a running emulator, or a Mac with a simulator.
//
// Usage: node gate.mjs <android|ios> [more arguments for expo run]
//
// Each run uses --no-bundler. Expo CLI then stops after the upload, and
// does not wait for Metro.
import { execFileSync, spawn } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const store = path.join(root, '.devhub')
const appJson = path.join(root, 'app.json')

// Expo SDK 57 has Swift packages with Swift tools 6.2 (Xcode 26). Expo CLI
// does not check it, and xcodebuild fails late with code 65.
const MIN_SWIFT = [6, 2]

class GateError extends Error {}

const [platform, ...runArgs] = process.argv.slice(2)
if (platform !== 'android' && platform !== 'ios') {
  console.error('Usage: node gate.mjs <android|ios> [more arguments]')
  process.exit(2)
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(root, 'with-store.mjs'), command, ...args],
      { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let stdout = ''
    let output = ''
    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk)
      stdout += chunk
      output += chunk
    })
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk)
      output += chunk
    })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stdout, output }))
  })
}

function check(condition, message) {
  if (!condition) {
    throw new GateError(message)
  }
}

function expectLine(result, text) {
  check(result.output.includes(text), `The output has no line with: ${text}`)
}

async function expoRun() {
  const result = await run('expo', [
    `run:${platform}`,
    '--no-bundler',
    ...deviceArgs(),
    ...runArgs,
  ])
  check(result.code === 0, `expo run:${platform} exited with ${result.code}.`)
  return result
}

let iosDevice
function deviceArgs() {
  if (platform !== 'ios' || runArgs.includes('--device')) {
    return []
  }
  iosDevice ??= newestIphone()
  return ['--device', iosDevice]
}

function newestIphone() {
  const { devices } = JSON.parse(
    execFileSync('xcrun', ['simctl', 'list', 'devices', 'available', '-j'], {
      encoding: 'utf8',
    }),
  )
  const runtimes = Object.keys(devices)
    .filter((runtime) => /\.iOS-\d/.test(runtime))
    .sort((a, b) => compareVersions(version(b), version(a)))
  for (const runtime of runtimes) {
    const phone = devices[runtime].find((device) =>
      device.name.startsWith('iPhone'),
    )
    if (phone !== undefined) {
      console.log(`Simulator: ${phone.name} (${runtime})`)
      return phone.udid
    }
  }
  throw new GateError('No iPhone simulator is available.')
}

function version(text) {
  return (text.match(/(\d+)[-.](\d+)/)?.slice(1) ?? []).map(Number)
}

function compareVersions(a, b) {
  return (a[0] ?? 0) - (b[0] ?? 0) || (a[1] ?? 0) - (b[1] ?? 0)
}

function checkSwift() {
  const text = execFileSync('xcrun', ['swift', '--version'], {
    encoding: 'utf8',
  })
  const found = version(text.match(/Swift version [\d.]+/)?.[0] ?? '')
  check(
    compareVersions(found, MIN_SWIFT) >= 0,
    `Expo SDK 57 needs Swift ${MIN_SWIFT.join('.')} or later (Xcode 26), and this Mac has Swift ${found.join('.') || 'unknown'}. Select Xcode 26 with xcode-select.`,
  )
}

async function storedBuilds(count) {
  const result = await run('devhub', ['list', '--json'])
  check(result.code === 0, `devhub list exited with ${result.code}.`)
  const builds = JSON.parse(result.stdout).builds.filter(
    (build) =>
      build.source === 'local' &&
      build.local.platform === platform.toUpperCase(),
  )
  check(
    builds.length === count,
    `The store has ${builds.length} ${platform} builds, not ${count}.`,
  )
  return builds
}

function removeNativeFolder() {
  rmSync(path.join(root, platform), { recursive: true, force: true })
}

function step(text) {
  console.log(`\n=== ${text}\n`)
}

const original = readFileSync(appJson, 'utf8')
const changed = original.replace(
  '"orientation": "portrait"',
  '"orientation": "default"',
)

try {
  check(changed !== original, 'app.json has no "orientation": "portrait".')
  if (platform === 'ios') {
    checkSwift()
  }
  rmSync(store, { recursive: true, force: true })
  removeNativeFolder()

  step('1. The first run builds the app, and DevHub stores the build.')
  let result = await expoRun()
  expectLine(result, `No stored build has the ${platform} fingerprint`)
  expectLine(result, 'Stored the build')
  const [first] = await storedBuilds(1)
  const firstId = first.id.slice(0, 8)

  step('2. The second run installs the stored build.')
  result = await expoRun()
  expectLine(result, `Expo CLI installs the stored build ${firstId}`)
  expectLine(result, store)
  await storedBuilds(1)

  step('3. A changed app config and the old native folder: no new build.')
  writeFileSync(appJson, changed)
  result = await expoRun()
  expectLine(
    result,
    'DevHub does not store this build. app.json changed after the last prebuild',
  )
  await storedBuilds(1)

  step('4. After a new prebuild, DevHub stores the build.')
  removeNativeFolder()
  result = await expoRun()
  expectLine(result, 'Stored the build')
  await storedBuilds(2)

  step('5. The first app config again: the run installs the first build.')
  writeFileSync(appJson, original)
  removeNativeFolder()
  result = await expoRun()
  expectLine(result, `Expo CLI installs the stored build ${firstId}`)
  await storedBuilds(2)

  step('6. devhub match shows the first build.')
  result = await run('devhub', ['match', '--json', '--platform', platform])
  check(result.code === 0, `devhub match exited with ${result.code}.`)
  const [match] = JSON.parse(result.stdout).platforms
  check(
    match?.matches.some((build) => build.id === first.id),
    `devhub match does not show the build ${firstId}.`,
  )

  console.log(`\nThe ${platform} gate passed.`)
} catch (error) {
  if (!(error instanceof GateError)) {
    throw error
  }
  console.error(`\nThe ${platform} gate failed: ${error.message}`)
  process.exitCode = 1
} finally {
  writeFileSync(appJson, original)
}
