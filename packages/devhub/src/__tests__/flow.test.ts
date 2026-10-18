import { mkdir } from 'node:fs/promises'
import os from 'node:os'
import { describe, expect, it } from 'vitest'
import type { CommandRunner } from '../command/run-command'
import { deviceReport } from '../flow/devices'
import { findStoredBuild } from '../flow/find'
import { installStoredBuild, type InstallDeps } from '../flow/install'
import { listBuilds } from '../flow/list'
import { buildFolder } from '../store/builds'
import {
  NOW,
  easBuild,
  fakeDeviceTools,
  useTempDir,
  writeStoredBuild,
} from './helpers'

const ID_A = 'aaaa1111-0000-4000-8000-000000000001'
const ID_B = 'aaaa2222-0000-4000-8000-000000000002'
const ID_C = 'cccc3333-0000-4000-8000-000000000003'
const EMULATOR_LINE =
  'emulator-5554  device product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64'

function adbList(...lines: string[]): string {
  return ['List of devices attached', ...lines, ''].join('\n')
}

function installDeps(home: string, run: CommandRunner) {
  const progress: string[] = []
  const deps: InstallDeps = {
    run,
    env: { DEVHUB_HOME: home },
    platform: process.platform,
    homedir: os.homedir(),
    cwd: home,
    progress: (text) => progress.push(text),
  }
  return { deps, progress }
}

function installCalls(calls: readonly (readonly string[])[]) {
  return calls.filter((command) => command.includes('install'))
}

describe('findStoredBuild', () => {
  const tempDir = useTempDir()

  it('returns the build of a unique ID prefix', async () => {
    const home = await tempDir()
    const file = await writeStoredBuild(home, easBuild({ id: ID_A }))
    await writeStoredBuild(home, easBuild({ id: ID_B }))

    const found = await findStoredBuild(home, 'aaaa1')

    expect(found).toMatchObject({ kind: 'ok', value: { id: ID_A, path: file } })
  })

  it('returns a failure, not a usage error, for a prefix that is not unique', async () => {
    const home = await tempDir()
    await writeStoredBuild(home, easBuild({ id: ID_A }))
    await writeStoredBuild(home, easBuild({ id: ID_B }))

    expect(await findStoredBuild(home, 'aaaa')).toEqual({
      kind: 'error',
      usage: false,
      message: `The ID "aaaa" matches 2 stored builds:\n  ${ID_A}\n  ${ID_B}\nGive more characters of the ID.`,
    })
  })
})

describe('listBuilds', () => {
  const tempDir = useTempDir()

  it('returns the JSON of devhub list, by project and then newest first', async () => {
    const home = await tempDir()
    const older = easBuild({
      id: ID_A,
      app: { id: 'a', slug: 'beta' },
      createdAt: '2026-10-01T10:00:00.000Z',
    })
    const newer = easBuild({
      id: ID_B,
      app: { id: 'a', slug: 'beta' },
      createdAt: '2026-10-02T10:00:00.000Z',
    })
    const other = easBuild({ id: ID_C, app: { id: 'b', slug: 'alpha' } })
    const files = {
      [ID_A]: await writeStoredBuild(home, older),
      [ID_B]: await writeStoredBuild(home, newer),
      [ID_C]: await writeStoredBuild(home, other),
    }
    const incomplete = 'dddd4444-0000-4000-8000-000000000004'
    await mkdir(buildFolder(home, incomplete), { recursive: true })

    const result = await listBuilds(home)

    expect(result.kind).toBe('ok')
    if (result.kind !== 'ok') {
      return
    }
    expect(result.value.builds.map((build) => build.id)).toEqual([
      ID_C,
      ID_B,
      ID_A,
    ])
    expect(result.value.builds[1]).toEqual({
      id: ID_B,
      path: files[ID_B],
      size: 6,
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      storedAt: NOW.toISOString(),
      eas: newer,
    })
    expect(result.value.incomplete).toEqual([incomplete])
    expect(result.value.unreadable).toEqual([])
  })
})

describe('installStoredBuild', () => {
  const tempDir = useTempDir()

  it('installs on the one ready device, and gives the progress line to progress', async () => {
    const home = await tempDir()
    const file = await writeStoredBuild(home, easBuild({ id: ID_A }))
    const tools = fakeDeviceTools({
      devices: adbList(EMULATOR_LINE),
      avdNames: { 'emulator-5554': 'Pixel_Light_34' },
    })
    const { deps, progress } = installDeps(home, tools.run)

    const result = await installStoredBuild({ id: 'aaaa' }, deps)

    expect(result).toEqual({
      kind: 'ok',
      value: {
        id: ID_A,
        path: file,
        device: expect.objectContaining({
          id: 'emulator-5554',
          name: 'Pixel_Light_34',
          ready: true,
        }),
      },
    })
    expect(progress).toEqual([
      `Installing the build ${ID_A} on Pixel_Light_34 (emulator-5554).`,
    ])
    expect(installCalls(tools.calls)).toHaveLength(1)
  })

  it('returns a usage error when two devices are ready, and installs nothing', async () => {
    const home = await tempDir()
    await writeStoredBuild(home, easBuild({ id: ID_A }))
    const tools = fakeDeviceTools({
      devices: adbList(EMULATOR_LINE, 'emulator-5556  device'),
    })
    const { deps, progress } = installDeps(home, tools.run)

    const result = await installStoredBuild({ id: ID_A }, deps)

    expect(result).toMatchObject({ kind: 'error', usage: true })
    expect(result.kind === 'error' && result.message).toContain(
      '2 devices are ready. Select one with --device <id>:',
    )
    expect(progress).toEqual([])
    expect(installCalls(tools.calls)).toEqual([])
  })

  it('returns the build check before it runs a device tool', async () => {
    const home = await tempDir()
    await writeStoredBuild(home, easBuild({ id: ID_A }), 'app.aab')
    const tools = fakeDeviceTools({ devices: adbList(EMULATOR_LINE) })
    const { deps } = installDeps(home, tools.run)

    const result = await installStoredBuild({ id: ID_A }, deps)

    expect(result).toMatchObject({ kind: 'error', usage: false })
    expect(result.kind === 'error' && result.message).toContain(
      'is an Android App Bundle (app.aab)',
    )
    expect(tools.calls).toEqual([])
  })

  it('returns a failed adb install as an error, and does not throw', async () => {
    const home = await tempDir()
    await writeStoredBuild(home, easBuild({ id: ID_A }))
    const tools = fakeDeviceTools({
      devices: adbList(EMULATOR_LINE),
      install: {
        code: 1,
        stdout: 'Performing Streamed Install\n',
        stderr: 'adb: failed to install: Failure [INSTALL_FAILED_OLDER_SDK]\n',
      },
    })
    const { deps } = installDeps(home, tools.run)

    const result = await installStoredBuild({ id: ID_A }, deps)

    expect(result).toMatchObject({ kind: 'error', usage: false })
    expect(result.kind === 'error' && result.message).toContain(
      '"adb install" failed with INSTALL_FAILED_OLDER_SDK.',
    )
  })
})

describe('deviceReport', () => {
  it('gives the error of each device tool that failed as a warning', () => {
    expect(
      deviceReport({
        devices: [],
        sources: [
          { platform: 'android', error: 'DevHub cannot find adb.' },
          { platform: 'ios' },
        ],
      }),
    ).toEqual({ devices: [], warnings: ['DevHub cannot find adb.'] })
  })
})
