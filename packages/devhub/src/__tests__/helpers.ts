import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach } from 'vitest'
import type { CliContext, Io } from '../cli/context'
import type { Command, CommandRunner } from '../command/run-command'
import type { EasBuild } from '../eas/build'
import { EAS_ON_PATH, EAS_WITH_NPX } from '../eas/cli'
import {
  BUILD_RECORD_SCHEMA_VERSION,
  buildFolder,
  type BuildRecord,
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

export type FakeEas = {
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
): FakeEas {
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
    schemaVersion: BUILD_RECORD_SCHEMA_VERSION,
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
