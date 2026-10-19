import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildFolder,
  findBuild,
  prepareBuildFolder,
  scanStore,
  storedBuildIds,
} from '../store/builds'
import { resolveHome } from '../store/home'
import { StoreLockedError, acquireSyncLock } from '../store/lock'
import { addProject, projectsFile, readProjects } from '../store/projects'
import {
  easBuild,
  localBuild,
  useTempDir,
  uuid,
  writeLocalBuild,
  writeStoredBuild,
} from './helpers'

describe('resolveHome', () => {
  const base = { env: {}, homedir: '/home/dev', cwd: '/work' }

  it('uses DEVHUB_HOME first, relative to the current folder', () => {
    expect(
      resolveHome({
        ...base,
        platform: 'darwin',
        env: { DEVHUB_HOME: 'store' },
      }),
    ).toBe('/work/store')
    expect(
      resolveHome({
        ...base,
        platform: 'linux',
        env: { DEVHUB_HOME: '/mnt/disk/devhub' },
      }),
    ).toBe('/mnt/disk/devhub')
  })

  it('uses Application Support on macOS', () => {
    expect(resolveHome({ ...base, platform: 'darwin' })).toBe(
      '/home/dev/Library/Application Support/devhub',
    )
  })

  it('uses XDG_DATA_HOME on Linux, and ignores a relative value', () => {
    expect(
      resolveHome({
        ...base,
        platform: 'linux',
        env: { XDG_DATA_HOME: '/data' },
      }),
    ).toBe('/data/devhub')
    expect(
      resolveHome({
        ...base,
        platform: 'linux',
        env: { XDG_DATA_HOME: 'data' },
      }),
    ).toBe('/home/dev/.local/share/devhub')
    expect(resolveHome({ ...base, platform: 'linux' })).toBe(
      '/home/dev/.local/share/devhub',
    )
  })

  it('uses LOCALAPPDATA on Windows', () => {
    const windows = { env: {}, homedir: 'C:\\Users\\dev', cwd: 'C:\\work' }
    expect(
      resolveHome({
        ...windows,
        platform: 'win32',
        env: { LOCALAPPDATA: 'D:\\AppData\\Local' },
      }),
    ).toBe('D:\\AppData\\Local\\devhub')
    expect(resolveHome({ ...windows, platform: 'win32' })).toBe(
      'C:\\Users\\dev\\AppData\\Local\\devhub',
    )
  })
})

describe('build folders', () => {
  const tempDir = useTempDir()

  it('replaces an incomplete folder from an interrupted sync', async () => {
    const home = await tempDir()
    const folder = buildFolder(home, uuid(1))
    await mkdir(folder, { recursive: true })
    await writeFile(path.join(folder, 'app.apk.123-abcd.tmp'), 'half a file')

    expect(await storedBuildIds(home)).toEqual(new Set())
    expect((await scanStore(home)).incomplete).toEqual([uuid(1)])

    await prepareBuildFolder(home, uuid(1))

    expect(await readdir(folder)).toEqual([])
  })

  it('never replaces a folder that has a build.json', async () => {
    const home = await tempDir()
    const file = await writeStoredBuild(home, easBuild({ id: uuid(1) }))

    await expect(prepareBuildFolder(home, uuid(1))).rejects.toThrow(
      'is already stored',
    )
    expect(await readFile(file, 'utf8')).toBe('binary')
  })

  it('counts a record from a newer DevHub as stored, but does not read it', async () => {
    const home = await tempDir()
    const folder = buildFolder(home, uuid(1))
    await mkdir(folder, { recursive: true })
    await writeFile(
      path.join(folder, 'build.json'),
      JSON.stringify({ schemaVersion: 3 }),
    )

    expect(await storedBuildIds(home)).toEqual(new Set([uuid(1)]))
    const scan = await scanStore(home)
    expect(scan.builds).toEqual([])
    expect(scan.unreadable[0]?.reason).toContain('A newer DevHub wrote it.')
  })

  it.each([
    ['not JSON', '{'],
    ['the wrong fields', JSON.stringify({ schemaVersion: 1 })],
    [
      'a file name outside the folder',
      JSON.stringify({
        schemaVersion: 1,
        storedAt: '',
        file: '../other/app.apk',
        size: 1,
        sha256: '',
        eas: easBuild({ id: uuid(1) }),
      }),
    ],
    [
      'a local record with no fingerprint',
      JSON.stringify({
        schemaVersion: 2,
        source: 'local',
        storedAt: '',
        file: 'app.apk',
        size: 1,
        sha256: '',
        local: { ...localBuild(), fingerprintHash: '' },
      }),
    ],
    [
      'a local record with a bad ABI list',
      JSON.stringify({
        schemaVersion: 2,
        source: 'local',
        storedAt: '',
        file: 'app.apk',
        size: 1,
        sha256: '',
        local: { ...localBuild(), abis: 'x86_64' },
      }),
    ],
    [
      'the ID of a different build',
      JSON.stringify({
        schemaVersion: 1,
        storedAt: '',
        file: 'app.apk',
        size: 1,
        sha256: '',
        eas: easBuild({ id: uuid(2) }),
      }),
    ],
  ])('reports a build.json with %s as unreadable', async (_name, content) => {
    const home = await tempDir()
    const folder = buildFolder(home, uuid(1))
    await mkdir(folder, { recursive: true })
    await writeFile(path.join(folder, 'build.json'), content)

    const scan = await scanStore(home)

    expect(scan.builds).toEqual([])
    expect(scan.unreadable.map((entry) => entry.id)).toEqual([uuid(1)])
  })

  it('reads a stored build with the absolute path of its file', async () => {
    const home = await tempDir()
    const file = await writeStoredBuild(home, easBuild({ id: uuid(1) }))

    const scan = await scanStore(home)

    expect(scan.builds).toHaveLength(1)
    expect(scan.builds[0]?.path).toBe(file)
    expect(scan.builds[0]?.record).toMatchObject({ eas: { id: uuid(1) } })
  })

  it('reads a local build record', async () => {
    const home = await tempDir()
    const local = localBuild()
    const file = await writeLocalBuild(home, uuid(1), local)

    const scan = await scanStore(home)

    expect(scan.unreadable).toEqual([])
    expect(scan.builds).toEqual([
      {
        id: uuid(1),
        path: file,
        record: expect.objectContaining({ schemaVersion: 2, local }),
      },
    ])
  })

  it('skips a temporary folder of a local build that is not complete', async () => {
    const home = await tempDir()
    await mkdir(path.join(home, 'builds', `.tmp-${uuid(1)}`), {
      recursive: true,
    })

    expect(await scanStore(home)).toEqual({
      builds: [],
      incomplete: [],
      unreadable: [],
    })
  })

  it('reads an empty store when the folder does not exist', async () => {
    const home = path.join(await tempDir(), 'nothing')

    expect(await scanStore(home)).toEqual({
      builds: [],
      incomplete: [],
      unreadable: [],
    })
  })
})

describe('findBuild', () => {
  const tempDir = useTempDir()

  async function builds() {
    const home = await tempDir()
    await writeStoredBuild(
      home,
      easBuild({ id: 'abc12345-0000-4000-8000-000000000001' }),
    )
    await writeStoredBuild(
      home,
      easBuild({ id: 'abc12399-0000-4000-8000-000000000002' }),
    )
    await writeStoredBuild(
      home,
      easBuild({ id: 'def00000-0000-4000-8000-000000000003' }),
    )
    return (await scanStore(home)).builds
  }

  it('finds a build by its full ID', async () => {
    const result = findBuild(
      await builds(),
      'abc12345-0000-4000-8000-000000000001',
    )
    expect(result.kind === 'found' && result.build.id).toBe(
      'abc12345-0000-4000-8000-000000000001',
    )
  })

  it('finds a build by a unique prefix, in any case', async () => {
    const result = findBuild(await builds(), 'ABC123')
    expect(result.kind).toBe('ambiguous')

    const unique = findBuild(await builds(), 'ABC1234')
    expect(unique.kind === 'found' && unique.build.id).toBe(
      'abc12345-0000-4000-8000-000000000001',
    )
  })

  it('reports a prefix that matches more than one build', async () => {
    const result = findBuild(await builds(), 'abc')
    expect(result.kind === 'ambiguous' && result.matches.length).toBe(2)
  })

  it('reports a prefix that matches no build', async () => {
    expect(findBuild(await builds(), 'fff').kind).toBe('none')
  })
})

describe('projects.json', () => {
  const tempDir = useTempDir()

  it('adds each project folder once, in the order seen', async () => {
    const home = await tempDir()

    await addProject(home, '/work/a')
    await addProject(home, '/work/b')
    await addProject(home, '/work/a')

    expect(await readProjects(home)).toEqual(['/work/a', '/work/b'])
    expect(JSON.parse(await readFile(projectsFile(home), 'utf8'))).toEqual({
      schemaVersion: 1,
      projects: [{ path: '/work/a' }, { path: '/work/b' }],
    })
  })

  it('reads no projects when the file does not exist', async () => {
    expect(await readProjects(await tempDir())).toEqual([])
  })

  it('gives the next step for a file that is not valid', async () => {
    const home = await tempDir()
    await writeFile(projectsFile(home), '{"projects": "x"}')

    await expect(readProjects(home)).rejects.toThrow(
      'Correct the file, or delete it',
    )
  })
})

describe('acquireSyncLock', () => {
  const tempDir = useTempDir()

  it('refuses a second sync while the first one holds the lock', async () => {
    const home = await tempDir()
    const lock = await acquireSyncLock(home)

    await expect(acquireSyncLock(home)).rejects.toThrow(StoreLockedError)

    await lock.release()
    const again = await acquireSyncLock(home)
    await again.release()
  })

  it('takes a lock from a process that no longer runs', async () => {
    const home = await tempDir()
    // The highest PID on Linux and macOS is much lower.
    await writeFile(path.join(home, 'sync.lock'), '2147483646\n')

    const lock = await acquireSyncLock(home)

    expect(await readFile(path.join(home, 'sync.lock'), 'utf8')).toBe(
      `${process.pid}\n`,
    )
    await lock.release()
  })
})
