import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { EasCliError } from '../eas/cli'
import { buildFolder, scanStore } from '../store/builds'
import { StoreLockedError, acquireSyncLock } from '../store/lock'
import { readProjects } from '../store/projects'
import { syncFailed, syncProjects, type SyncDeps } from '../sync/sync'
import {
  NOW,
  easBuild,
  fakeDownload,
  fakeEas,
  useTempDir,
  uuid,
  writeProject,
} from './helpers'

const DEV_CLIENT = { build: { development: { developmentClient: true } } }

function deps(
  home: string,
  eas: ReturnType<typeof fakeEas>,
  download = fakeDownload(),
): SyncDeps {
  return { home, run: eas.run, download, now: () => NOW, progress: () => {} }
}

function options(
  projects: string[],
  extra: Partial<{ dryRun: boolean; extraProfiles: string[] }> = {},
) {
  return { projects, extraProfiles: [], dryRun: false, cwd: '/', ...extra }
}

describe('syncProjects', () => {
  const tempDir = useTempDir()

  async function setup() {
    const root = await tempDir()
    const home = path.join(root, 'home')
    const project = await writeProject(path.join(root, 'app'), DEV_CLIENT)
    return { root, home, project }
  }

  it('downloads each unexpired build once, and a second sync downloads nothing', async () => {
    const { home, project } = await setup()
    const eas = fakeEas({
      development: [
        easBuild({ id: uuid(1) }),
        easBuild({ id: uuid(2), platform: 'IOS', isForIosSimulator: true }),
        easBuild({ id: uuid(3), expirationDate: '2026-09-01T00:00:00.000Z' }),
      ],
    })
    const download = fakeDownload()

    const first = await syncProjects(
      options([project]),
      deps(home, eas, download),
    )

    expect(first.projects[0]?.builds.map((b) => [b.id, b.status])).toEqual([
      [uuid(1), 'downloaded'],
      [uuid(2), 'downloaded'],
      [uuid(3), 'expired'],
    ])
    expect(download.urls).toHaveLength(2)
    expect(syncFailed(first)).toBe(false)

    const second = await syncProjects(
      options([project]),
      deps(home, eas, download),
    )

    expect(second.projects[0]?.builds.map((b) => b.status)).toEqual([
      'stored',
      'stored',
      'expired',
    ])
    expect(download.urls).toHaveLength(2)
  })

  it('writes a record with the EAS record unchanged', async () => {
    const { home, project } = await setup()
    const build = easBuild({ id: uuid(1), futureField: [1, 2] })
    const eas = fakeEas({ development: [build] })

    await syncProjects(options([project]), deps(home, eas))

    const scan = await scanStore(home)
    expect(scan.builds).toHaveLength(1)
    const stored = scan.builds[0]
    expect(stored?.record).toEqual({
      schemaVersion: 1,
      storedAt: NOW.toISOString(),
      file: `${uuid(1)}.apk`,
      size: Buffer.byteLength(build.artifacts?.applicationArchiveUrl ?? ''),
      sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      eas: build,
    })
    expect(await readFile(stored?.path ?? '', 'utf8')).toBe(
      build.artifacts?.applicationArchiveUrl,
    )
  })

  it('replaces an incomplete folder that an interrupted sync left', async () => {
    const { home, project } = await setup()
    const folder = buildFolder(home, uuid(1))
    await mkdir(folder, { recursive: true })
    await writeFile(path.join(folder, 'old.apk.1-abcd.tmp'), 'half')
    const eas = fakeEas({ development: [easBuild({ id: uuid(1) })] })

    const report = await syncProjects(options([project]), deps(home, eas))

    expect(report.projects[0]?.builds[0]?.status).toBe('downloaded')
    expect((await readdir(folder)).sort()).toEqual([
      `${uuid(1)}.apk`,
      'build.json',
    ])
  })

  it('reports a failed download, removes its folder, and continues', async () => {
    const { home, project } = await setup()
    const failing = easBuild({ id: uuid(1) })
    const eas = fakeEas({
      development: [failing, easBuild({ id: uuid(2) })],
    })
    const download = fakeDownload(
      new Set([failing.artifacts?.applicationArchiveUrl ?? '']),
    )

    const report = await syncProjects(
      options([project]),
      deps(home, eas, download),
    )

    expect(report.projects[0]?.builds.map((b) => b.status)).toEqual([
      'failed',
      'downloaded',
    ])
    expect(report.projects[0]?.builds[0]?.error).toContain('HTTP 403')
    expect(syncFailed(report)).toBe(true)
    expect(await readdir(path.join(home, 'builds'))).toEqual([uuid(2)])
  })

  it('downloads nothing and records no project in a dry run', async () => {
    const { home, project } = await setup()
    const eas = fakeEas({ development: [easBuild({ id: uuid(1) })] })
    const download = fakeDownload()

    const report = await syncProjects(
      options([project], { dryRun: true }),
      deps(home, eas, download),
    )

    expect(report.dryRun).toBe(true)
    expect(report.projects[0]?.builds[0]?.status).toBe('would-download')
    expect(download.urls).toEqual([])
    expect(await readProjects(home)).toEqual([])
  })

  it('syncs the profiles from --profile too', async () => {
    const { home, project } = await setup()
    const eas = fakeEas({
      development: [easBuild({ id: uuid(1) })],
      preview: [easBuild({ id: uuid(2), buildProfile: 'preview' })],
    })

    const report = await syncProjects(
      options([project], { extraProfiles: ['preview'] }),
      deps(home, eas),
    )

    expect(report.projects[0]?.builds.map((b) => [b.id, b.profile])).toEqual([
      [uuid(1), 'development'],
      [uuid(2), 'preview'],
    ])
  })

  it('records the project folder after a sync', async () => {
    const { home, project } = await setup()

    await syncProjects(options([project]), deps(home, fakeEas({})))

    expect(await readProjects(home)).toEqual([project])
  })

  it('covers each project, warns about a missing folder, and continues after a failure', async () => {
    const { root, home, project } = await setup()
    const second = await writeProject(path.join(root, 'second'), DEV_CLIENT)
    const noDevClient = await writeProject(path.join(root, 'plain'), {
      build: { production: {} },
    })
    const missing = path.join(root, 'deleted')
    const eas = fakeEas({ development: [easBuild({ id: uuid(1) })] })

    const report = await syncProjects(
      options([project, missing, noDevClient, second]),
      deps(home, eas),
    )

    expect(report.projects.map((p) => [p.project, p.status])).toEqual([
      [project, 'ok'],
      [missing, 'missing'],
      [noDevClient, 'failed'],
      [second, 'ok'],
    ])
    expect(report.projects[1]?.warnings[0]).toContain('does not exist')
    expect(report.projects[2]?.error).toContain('"developmentClient": true')
    expect(report.projects[3]?.builds[0]?.status).toBe('stored')
    expect(syncFailed(report)).toBe(true)
  })

  it('does not count a missing folder as a failure', async () => {
    const { root, home } = await setup()

    const report = await syncProjects(
      options([path.join(root, 'deleted')]),
      deps(home, fakeEas({})),
    )

    expect(syncFailed(report)).toBe(false)
  })

  it('stops before any project when eas has no login', async () => {
    const { home, project } = await setup()
    const eas = fakeEas({}, { whoami: { code: 1, stderr: 'Not logged in' } })

    await expect(
      syncProjects(options([project]), deps(home, eas)),
    ).rejects.toThrow(EasCliError)
    expect(eas.calls).toHaveLength(1)
  })

  it('stops when another sync holds the lock, and a dry run does not need it', async () => {
    const { home, project } = await setup()
    const lock = await acquireSyncLock(home)
    try {
      await expect(
        syncProjects(options([project]), deps(home, fakeEas({}))),
      ).rejects.toThrow(StoreLockedError)
      await expect(
        syncProjects(
          options([project], { dryRun: true }),
          deps(home, fakeEas({})),
        ),
      ).resolves.toBeDefined()
    } finally {
      await lock.release()
    }
  })

  it('releases the lock after a sync', async () => {
    const { home, project } = await setup()

    await syncProjects(options([project]), deps(home, fakeEas({})))

    expect(await readdir(home)).not.toContain('sync.lock')
  })
})
