import { createHash } from 'node:crypto'
import {
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach } from 'vitest'
import type { CliContext, Io } from '../cli/context'
import type {
  Command,
  CommandResult,
  CommandRunner,
} from '../command/run-command'
import type { EasBuild } from '../eas/build'
import { EAS_ON_PATH, EAS_WITH_NPX } from '../eas/cli'
import {
  EAS_RECORD_SCHEMA_VERSION,
  LOCAL_RECORD_SCHEMA_VERSION,
  buildFolder,
  type BuildRecord,
  type LocalBuild,
  type LocalBuildRecord,
} from '../store/builds'
import type { Downloader } from '../sync/download'

export const NOW = new Date('2026-10-17T12:00:00.000Z')

export function easBuild(overrides: Partial<EasBuild> = {}): EasBuild {
  const id = overrides.id ?? '11111111-1111-4111-8111-111111111111'
  return {
    id,
    status: 'FINISHED',
    platform: 'ANDROID',
    buildProfile: 'development',
    distribution: 'INTERNAL',
    appVersion: '1.0.0',
    gitCommitHash: '0123456789abcdef0123456789abcdef01234567',
    app: { id: 'app-id', slug: 'my-app', name: 'My App' },
    createdAt: '2026-10-01T10:00:00.000Z',
    completedAt: '2026-10-01T10:20:00.000Z',
    expirationDate: '2026-10-31T10:20:00.000Z',
    artifacts: {
      applicationArchiveUrl: `https://expo.dev/artifacts/eas/${id}.apk`,
    },
    ...overrides,
  }
}

export function uuid(n: number): string {
  const hex = n.toString(16).padStart(12, '0')
  return `00000000-0000-4000-8000-${hex}`
}

/** A temporary folder that the test deletes after it runs. */
export function useTempDir(): () => Promise<string> {
  const dirs: string[] = []
  afterEach(async () => {
    await Promise.all(
      dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
    )
  })
  return async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'devhub-test-'))
    dirs.push(dir)
    return dir
  }
}

export function capture() {
  const out: string[] = []
  const err: string[] = []
  const io: Io = {
    out: (text) => out.push(text),
    err: (text) => err.push(text),
  }
  return { io, out, err }
}

export type FakeRunner = {
  run: CommandRunner
  calls: Command[]
}

/**
 * A fake `eas` that knows the finished builds of each profile and answers
 * `eas build:list` one page at a time, the same as eas-cli.
 */
export function fakeEas(
  buildsByProfile: Record<string, EasBuild[]>,
  options: {
    whoami?: { code: number; stderr: string }
    /** `false`: `eas` is not on PATH, and only npx starts eas-cli. */
    easOnPath?: boolean
  } = {},
): FakeRunner {
  const calls: Command[] = []
  const run: CommandRunner = async (command) => {
    calls.push(command)
    if (command[0] === 'eas' && options.easOnPath === false) {
      throw Object.assign(new Error('spawn eas ENOENT'), { code: 'ENOENT' })
    }
    const prefix = command[0] === 'npx' ? EAS_WITH_NPX : EAS_ON_PATH
    const [subcommand, ...args] = command.slice(prefix.length)
    if (subcommand === 'whoami') {
      const { code, stderr } = options.whoami ?? { code: 0, stderr: '' }
      return { code, stdout: code === 0 ? 'someone\n' : '', stderr }
    }
    if (subcommand === 'build:list') {
      const flag = (name: string) => args[args.indexOf(name) + 1] ?? ''
      const builds = buildsByProfile[flag('--build-profile')] ?? []
      const offset = Number(flag('--offset'))
      const limit = Number(flag('--limit'))
      const page = builds.slice(offset, offset + limit)
      return { code: 0, stdout: JSON.stringify(page, null, 2), stderr: '' }
    }
    return { code: 1, stdout: '', stderr: `unknown command ${subcommand}` }
  }
  return { run, calls }
}

/**
 * A fake for the device tools. adb answers `adb devices -l` with `devices`,
 * and `adb -s <serial> emu avd name` from `avdNames`. `xcrun simctl list`
 * answers with `simulators`, and `adb -s <serial> install` with `install`.
 * `tar -xf <archive> -C <folder>` makes the folders in `archive`, and
 * `xcrun simctl install` answers with `simctlInstall`. It finds a tool by
 * the base name, because the runner can get the full path of a real SDK.
 */
export function fakeDeviceTools(
  options: {
    devices?: string
    /** The AVD name of each emulator serial. A missing serial fails. */
    avdNames?: Record<string, string>
    /** `true`: adb does not start. */
    adbMissing?: boolean
    adbFailure?: { code: number; stderr: string }
    /** The JSON value that `xcrun simctl list devices --json` prints. */
    simulators?: unknown
    /** `true`: xcrun does not start. */
    xcrunMissing?: boolean
    simctlFailure?: { code: number; stderr: string }
    /** The answer to `adb -s <serial> install`. The default is a success. */
    install?: CommandResult
    /** The folders that `tar` unpacks. The default is one `My App.app`. */
    archive?: string[]
    tarFailure?: { code: number; stderr: string }
    /** The answer to `xcrun simctl install`. The default is a success. */
    simctlInstall?: CommandResult
  } = {},
): FakeRunner {
  const calls: Command[] = []
  const notFound = (program: string) =>
    Object.assign(new Error(`spawn ${program} ENOENT`), { code: 'ENOENT' })
  const run: CommandRunner = async (command) => {
    calls.push(command)
    const program = path.basename(command[0]).replace(/\.exe$/i, '')
    if (program === 'tar') {
      if (options.tarFailure) {
        return { stdout: '', ...options.tarFailure }
      }
      if (command[1] === '-czf') {
        await writeFile(command[2] ?? '', `packed ${command.at(-1) ?? ''}`)
        return { code: 0, stdout: '', stderr: '' }
      }
      const folder = command[command.indexOf('-C') + 1] ?? ''
      for (const entry of options.archive ?? ['My App.app']) {
        await mkdir(path.join(folder, entry), { recursive: true })
        await writeFile(path.join(folder, entry, 'Info.plist'), '')
      }
      return { code: 0, stdout: '', stderr: '' }
    }
    if (program === 'xcrun') {
      if (options.xcrunMissing) {
        throw notFound(command[0])
      }
      if (command[2] === 'install') {
        return options.simctlInstall ?? { code: 0, stdout: '', stderr: '' }
      }
      if (options.simctlFailure) {
        return { stdout: '', ...options.simctlFailure }
      }
      return {
        code: 0,
        stdout: JSON.stringify(options.simulators ?? { devices: {} }),
        stderr: '',
      }
    }
    if (program !== 'adb' || options.adbMissing) {
      throw notFound(command[0])
    }
    if (command[1] === 'devices') {
      if (options.adbFailure) {
        return { stdout: '', ...options.adbFailure }
      }
      return {
        code: 0,
        stdout: options.devices ?? 'List of devices attached\n\n',
        stderr: '',
      }
    }
    const [, flag, serial = '', ...rest] = command
    if (flag === '-s' && rest[0] === 'install') {
      return (
        options.install ?? {
          code: 0,
          stdout: 'Performing Streamed Install\nSuccess\n',
          stderr: '',
        }
      )
    }
    if (flag === '-s' && rest.join(' ') === 'emu avd name') {
      const name = options.avdNames?.[serial]
      return name === undefined
        ? {
            code: 1,
            stdout: '',
            stderr: `error: could not connect to TCP port ${serial.slice(9)}: Connection refused`,
          }
        : { code: 0, stdout: `${name}\r\nOK\r\n`, stderr: '' }
    }
    return { code: 1, stdout: '', stderr: `unknown command ${command[1]}` }
  }
  return { run, calls }
}

/** A fake download that writes the URL as the file content. */
export function fakeDownload(
  failures: ReadonlySet<string> = new Set(),
): Downloader & { urls: string[] } {
  const urls: string[] = []
  const download = async (url: string, target: string) => {
    urls.push(url)
    if (failures.has(url)) {
      throw new Error('The download failed with HTTP 403 Forbidden.')
    }
    await writeFile(target, url)
    return {
      size: Buffer.byteLength(url),
      sha256: createHash('sha256').update(url).digest('hex'),
    }
  }
  return Object.assign(download, { urls })
}

export async function writeStoredBuild(
  home: string,
  eas: EasBuild,
  file = 'app.apk',
): Promise<string> {
  const folder = buildFolder(home, eas.id)
  await mkdir(folder, { recursive: true })
  await writeFile(path.join(folder, file), 'binary')
  const record: BuildRecord = {
    schemaVersion: EAS_RECORD_SCHEMA_VERSION,
    storedAt: NOW.toISOString(),
    file,
    size: 6,
    sha256: createHash('sha256').update('binary').digest('hex'),
    eas,
  }
  await writeFile(path.join(folder, 'build.json'), JSON.stringify(record))
  return path.join(folder, file)
}

export async function writeProject(
  dir: string,
  easJson: unknown,
): Promise<string> {
  await mkdir(dir, { recursive: true })
  await writeFile(
    path.join(dir, 'eas.json'),
    typeof easJson === 'string' ? easJson : JSON.stringify(easJson),
  )
  return dir
}

export function testContext(
  overrides: Partial<CliContext> & { io: Io; home: string },
): Partial<CliContext> {
  const { home, ...rest } = overrides
  return {
    env: { DEVHUB_HOME: home },
    platform: process.platform,
    homedir: os.homedir(),
    now: () => NOW,
    ...rest,
  }
}

export type FakeFingerprintOptions = {
  /** The hash for each platform. A missing platform gives no hash. */
  hashes?: Partial<Record<'android' | 'ios', string>>
  /** The version in the package.json of `@expo/fingerprint`. */
  version?: string
  /** The message of the error that `createFingerprintAsync` throws. */
  failure?: string
  /**
   * `expo`: `expo/fingerprint` resolves, the same as in SDK 52 and later.
   * `direct`: only `@expo/fingerprint` resolves.
   */
  layout?: 'expo' | 'direct'
}

export const FINGERPRINT_CALLS_FILE = 'fingerprint-calls.json'

/**
 * A project folder with a package.json and a fake `expo/fingerprint`. The
 * fake answers with the hash of the one platform in `options.platforms`, and
 * appends each call to `fingerprint-calls.json` in the project folder.
 * Returns the real path, because Node resolves a module to its real path.
 */
export async function writeFingerprintProject(
  dir: string,
  options: FakeFingerprintOptions = {},
): Promise<string> {
  const layout = options.layout ?? 'expo'
  await mkdir(dir, { recursive: true })
  dir = await realpath(dir)
  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'my-app', version: '1.0.0' }),
  )
  const calls = path.join(dir, FINGERPRINT_CALLS_FILE)
  const module = `const fs = require('node:fs')
const HASHES = ${JSON.stringify(options.hashes ?? {})}
const FAILURE = ${JSON.stringify(options.failure ?? null)}
exports.createFingerprintAsync = async (projectRoot, options) => {
  const file = ${JSON.stringify(calls)}
  const calls = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : []
  calls.push({ projectRoot, options })
  fs.writeFileSync(file, JSON.stringify(calls))
  if (FAILURE !== null) {
    throw new Error(FAILURE)
  }
  const hash = HASHES[options.platforms[0]]
  return hash === undefined ? {} : { hash, sources: [] }
}
`
  const fingerprintDir = path.join(dir, 'node_modules', '@expo', 'fingerprint')
  await mkdir(path.join(fingerprintDir, 'build'), { recursive: true })
  await writeFile(
    path.join(fingerprintDir, 'package.json'),
    JSON.stringify({
      name: '@expo/fingerprint',
      version: options.version ?? '0.20.13',
      main: 'build/index.js',
    }),
  )
  await writeFile(path.join(fingerprintDir, 'build', 'index.js'), module)
  if (layout === 'expo') {
    const expoDir = path.join(dir, 'node_modules', 'expo')
    await mkdir(expoDir, { recursive: true })
    await writeFile(
      path.join(expoDir, 'package.json'),
      JSON.stringify({ name: 'expo', version: '54.0.0' }),
    )
    await writeFile(
      path.join(expoDir, 'fingerprint.js'),
      "module.exports = require('@expo/fingerprint')\n",
    )
  }
  return dir
}

/** The calls that the fake `expo/fingerprint` of the project received. */
export async function fingerprintCalls(
  dir: string,
): Promise<{ projectRoot: string; options: unknown }[]> {
  const text = await readFile(path.join(dir, FINGERPRINT_CALLS_FILE), 'utf8')
  return JSON.parse(text) as { projectRoot: string; options: unknown }[]
}

export function localBuild(overrides: Partial<LocalBuild> = {}): LocalBuild {
  return {
    platform: 'ANDROID',
    fingerprintHash: '3333333333333333333333333333333333333333',
    variant: 'debug',
    project: '/work/my-app',
    slug: 'my-app',
    appIdentifier: 'com.example.myapp',
    appVersion: '1.2.0',
    gitCommitHash: '89abcdef0123456789abcdef0123456789abcdef',
    abis: ['x86_64'],
    ...overrides,
  }
}

/** Writes a local build record, the same as `storeLocalBuild` writes it. */
export async function writeLocalBuild(
  home: string,
  id: string,
  local: LocalBuild,
  file = 'app.apk',
): Promise<string> {
  const folder = buildFolder(home, id)
  await mkdir(folder, { recursive: true })
  await writeFile(path.join(folder, file), 'binary')
  const record: LocalBuildRecord = {
    schemaVersion: LOCAL_RECORD_SCHEMA_VERSION,
    source: 'local',
    storedAt: NOW.toISOString(),
    file,
    size: 6,
    sha256: createHash('sha256').update('binary').digest('hex'),
    local,
  }
  await writeFile(path.join(folder, 'build.json'), JSON.stringify(record))
  return path.join(folder, file)
}

/**
 * A ZIP file with an empty entry for each name: enough for the APK ABI
 * reader. Each entry has a local header, the same as a real ZIP file.
 */
export function zipFile(names: readonly string[], comment = ''): Buffer {
  const parts: Buffer[] = []
  const entries: Buffer[] = []
  let offset = 0
  for (const name of names) {
    const bytes = Buffer.from(name, 'utf8')
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(bytes.length, 26)
    parts.push(header, bytes)
    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4)
    entry.writeUInt16LE(20, 6)
    entry.writeUInt16LE(bytes.length, 28)
    entry.writeUInt32LE(offset, 42)
    entries.push(entry, bytes)
    offset += header.length + bytes.length
  }
  const directory = Buffer.concat(entries)
  const commentBytes = Buffer.from(comment, 'utf8')
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(names.length, 8)
  end.writeUInt16LE(names.length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(commentBytes.length, 20)
  return Buffer.concat([...parts, directory, end, commentBytes])
}
