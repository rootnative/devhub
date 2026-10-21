import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CommandRunner } from '../command/run-command'
import { deviceReport } from '../flow/devices'
import { findStoredBuild } from '../flow/find'
import { installStoredBuild, type InstallDeps } from '../flow/install'
import { listBuilds } from '../flow/list'
import { syncBuilds } from '../flow/sync'
import { buildFolder } from '../store/builds'
import {
  NOW,
  easBuild,
  fakeDeviceTools,
  fakeDownload,
  fakeEas,
  localBuild,
  useTempDir,
  writeLocalBuild,
  writeStoredBuild,
} from './helpers'

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

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

    const result = await listBuilds(home, process.platform)

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
      source: 'eas',
      path: files[ID_B],
      size: 6,
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      storedAt: NOW.toISOString(),
      eas: newer,
    })
    expect(result.value.store).toBe(home)
    expect(result.value.incomplete).toEqual([incomplete])
    expect(result.value.unreadable).toEqual([])
  })

  it('gives the install problem of each build that devhub install refuses', async () => {
    const home = await tempDir()
    await writeStoredBuild(home, easBuild({ id: ID_A }))
    await writeStoredBuild(home, easBuild({ id: ID_B }), 'app.aab')
    await writeStoredBuild(home, easBuild({ id: ID_C, platform: 'IOS' }))

    const onLinux = await listBuilds(home, 'linux')

    expect(onLinux.kind).toBe('ok')
    if (onLinux.kind !== 'ok') {
      return
    }
    const problems = Object.fromEntries(
      onLinux.value.builds.map((build) => [build.id, build.installProblem]),
    )
    const apk = onLinux.value.builds.find((build) => build.id === ID_A)
    expect(apk === undefined || 'installProblem' in apk).toBe(false)
    expect(problems[ID_B]).toContain('adb installs only an APK.')
    expect(problems[ID_C]).toContain('iOS simulators run only on macOS')
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

  it('refuses a build whose file does not have the SHA-256 of its record', async () => {
    const home = await tempDir()
    const file = await writeStoredBuild(home, easBuild({ id: ID_A }))
    await writeFile(file, 'changed')
    const tools = fakeDeviceTools({ devices: adbList(EMULATOR_LINE) })
    const { deps, progress } = installDeps(home, tools.run)

    const result = await installStoredBuild({ id: ID_A }, deps)

    expect(result).toMatchObject({ kind: 'error', usage: false })
    const message = result.kind === 'error' ? result.message : ''
    expect(message).toContain(
      `The file ${file} of the build ${ID_A} has the SHA-256 ${sha256('changed')}, but its record has ${sha256('binary')}.`,
    )
    expect(message).toContain('run devhub sync in the project')
    expect(progress).toEqual([])
    expect(installCalls(tools.calls)).toEqual([])
  })

  it('names npx expo run for a local build whose file changed', async () => {
    const home = await tempDir()
    const file = await writeLocalBuild(home, ID_C, localBuild())
    await writeFile(file, 'changed')
    const tools = fakeDeviceTools({ devices: adbList(EMULATOR_LINE) })
    const { deps } = installDeps(home, tools.run)

    const result = await installStoredBuild({ id: ID_C }, deps)

    expect(result).toMatchObject({ kind: 'error', usage: false })
    expect(result.kind === 'error' && result.message).toContain(
      `Delete the folder ${path.dirname(file)}, and then run npx expo run:android in the project to store the build again.`,
    )
    expect(installCalls(tools.calls)).toEqual([])
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

describe('syncBuilds', () => {
  const tempDir = useTempDir()

  function syncDeps(home: string, cwd: string, run: CommandRunner) {
    return {
      env: { DEVHUB_HOME: home },
      platform: process.platform,
      homedir: os.homedir(),
      cwd,
      run,
      download: fakeDownload(),
      now: () => NOW,
      progress: () => {},
    }
  }

  it('returns a report with no projects, and runs no eas command, when DevHub knows no project', async () => {
    const root = await tempDir()
    const eas = fakeEas({})

    const result = await syncBuilds(
      { all: true, extraProfiles: [], dryRun: false },
      syncDeps(root, root, eas.run),
    )

    expect(result).toEqual({
      kind: 'ok',
      value: { dryRun: false, projects: [] },
    })
    expect(eas.calls).toEqual([])
  })

  it('returns a failure, not a usage error, for a folder with no eas.json', async () => {
    const root = await tempDir()

    const result = await syncBuilds(
      { all: false, extraProfiles: [], dryRun: false },
      syncDeps(root, root, fakeEas({}).run),
    )

    expect(result).toEqual({
      kind: 'error',
      usage: false,
      message: `${root} and its parent folders have no eas.json. Run devhub sync in the folder of an EAS project.`,
    })
  })
})
