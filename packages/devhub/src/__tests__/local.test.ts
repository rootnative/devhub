import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, utimes, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { apkAbis } from '../binary/apk'
import { runCommand } from '../command/run-command'
import { listBuilds } from '../flow/list'
import { tarCreateCommand, unpackIosBuild } from '../install/unpack'
import { storeLocalBuild, type LocalBuildInput } from '../local/store-local'
import { buildsRoot, scanStore } from '../store/builds'
import {
  NOW,
  fakeDeviceTools,
  localBuild,
  useTempDir,
  zipFile,
} from './helpers'

const APK_ENTRIES = [
  'AndroidManifest.xml',
  'classes.dex',
  'lib/x86_64/libreactnative.so',
  'lib/x86_64/libhermes.so',
  'lib/arm64-v8a/libhermes.so',
  'lib/armeabi-v7a/',
  'assets/lib/fake/libnot.so',
]

describe('apkAbis', () => {
  const tempDir = useTempDir()

  async function apk(entries: readonly string[], comment = '') {
    const file = path.join(await tempDir(), 'app.apk')
    await writeFile(file, zipFile(entries, comment))
    return file
  }

  it('returns the lib folders that hold a .so file, sorted', async () => {
    expect(await apkAbis(await apk(APK_ENTRIES))).toEqual([
      'arm64-v8a',
      'x86_64',
    ])
  })

  it('returns no ABI for an APK with no native code', async () => {
    expect(
      await apkAbis(await apk(['AndroidManifest.xml', 'classes.dex'])),
    ).toEqual([])
  })

  it('finds the end record before a ZIP comment', async () => {
    expect(
      await apkAbis(await apk(['lib/x86/libc++_shared.so'], 'signed')),
    ).toEqual(['x86'])
  })

  it('refuses a file that is not a ZIP file', async () => {
    const file = path.join(await tempDir(), 'app.apk')
    await writeFile(file, 'not a zip file')

    await expect(apkAbis(file)).rejects.toThrow(
      `${file} is not an APK. DevHub cannot read it as a ZIP file.`,
    )
  })
})

describe('tarCreateCommand', () => {
  it('keeps a path with a space as one argument', () => {
    expect(
      tarCreateCommand('/My Store/app.tar.gz', '/Build Out', 'My App.app'),
    ).toEqual([
      'tar',
      '-czf',
      '/My Store/app.tar.gz',
      '-C',
      '/Build Out',
      'My App.app',
    ])
  })
})

describe('storeLocalBuild', () => {
  const tempDir = useTempDir()

  async function androidInput(): Promise<LocalBuildInput> {
    const dir = await tempDir()
    const apk = path.join(dir, 'app-debug.apk')
    await writeFile(apk, zipFile(['lib/x86_64/libhermes.so', 'classes.dex']))
    const { abis: _abis, ...local } = localBuild({ project: dir })
    return { path: apk, local }
  }

  async function iosInput(): Promise<LocalBuildInput> {
    const dir = await tempDir()
    const app = path.join(dir, 'Build Products', 'My App.app')
    await mkdir(app, { recursive: true })
    await writeFile(path.join(app, 'Info.plist'), 'plist')
    const { abis: _abis, ...local } = localBuild({
      platform: 'IOS',
      variant: 'Debug',
      project: dir,
    })
    return { path: app, local }
  }

  it('copies an APK with its ABIs, and writes the record last', async () => {
    const home = await tempDir()
    const input = await androidInput()
    const content = await readFile(input.path)

    const stored = await storeLocalBuild(input, {
      home,
      run: fakeDeviceTools().run,
      now: () => NOW,
    })

    expect(stored.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    expect(stored.path).toBe(path.join(home, 'builds', stored.id, 'app.apk'))
    expect(await readFile(stored.path)).toEqual(content)
    expect(stored.record).toEqual({
      schemaVersion: 2,
      source: 'local',
      storedAt: NOW.toISOString(),
      file: 'app.apk',
      size: content.length,
      sha256: createHash('sha256').update(content).digest('hex'),
      local: { ...input.local, abis: ['x86_64'] },
    })
    expect(await readdir(buildsRoot(home))).toEqual([stored.id])
    expect((await scanStore(home)).builds).toEqual([stored])
  })

  it('lists a local build with its source in the list JSON', async () => {
    const home = await tempDir()
    const stored = await storeLocalBuild(await androidInput(), {
      home,
      run: fakeDeviceTools().run,
      now: () => NOW,
    })

    const result = await listBuilds(home, process.platform)

    expect(result).toMatchObject({
      kind: 'ok',
      value: {
        builds: [
          {
            id: stored.id,
            source: 'local',
            path: stored.path,
            local: stored.record.local,
          },
        ],
      },
    })
    expect(result.kind === 'ok' && result.value.builds[0]).not.toHaveProperty(
      'installProblem',
    )
  })

  it('packs a .app folder into a .tar.gz with the architecture', async () => {
    const home = await tempDir()
    const input = await iosInput()
    const tools = fakeDeviceTools()

    const stored = await storeLocalBuild(input, {
      home,
      run: tools.run,
      now: () => NOW,
      arch: 'arm64',
    })

    expect(stored.record).toMatchObject({
      file: 'app.tar.gz',
      local: { ...input.local, hostArch: 'arm64' },
    })
    expect(stored.record).not.toHaveProperty('local.abis')
    expect(tools.calls).toEqual([
      [
        'tar',
        '-czf',
        path.join(buildsRoot(home), `.tmp-${stored.id}`, 'app.tar.gz'),
        '-C',
        path.dirname(input.path),
        'My App.app',
      ],
    ])
    expect(await readFile(stored.path, 'utf8')).toBe('packed My App.app')
  })

  it('refuses a file of the wrong kind, and leaves no folder', async () => {
    const home = await tempDir()
    const android = await androidInput()
    const ios = await iosInput()
    const options = { home, run: fakeDeviceTools().run, now: () => NOW }

    await expect(
      storeLocalBuild({ ...android, path: `${android.path}.aab` }, options),
    ).rejects.toThrow('DevHub stores only an .apk for Android')
    await expect(
      storeLocalBuild({ ...ios, path: path.dirname(ios.path) }, options),
    ).rejects.toThrow('DevHub stores only a .app folder for iOS')
    expect(await readdir(buildsRoot(home))).toEqual([])
  })

  it('removes the temporary folder when tar fails', async () => {
    const home = await tempDir()
    const tools = fakeDeviceTools({
      tarFailure: { code: 1, stderr: 'tar: Write error' },
    })

    await expect(
      storeLocalBuild(await iosInput(), {
        home,
        run: tools.run,
        now: () => NOW,
      }),
    ).rejects.toThrow('"tar -czf" failed with exit code 1.\ntar: Write error')
    expect(await readdir(buildsRoot(home))).toEqual([])
  })

  it('removes a temporary folder from a crash, but not one in use', async () => {
    const home = await tempDir()
    const root = buildsRoot(home)
    const stale = path.join(root, '.tmp-stale')
    const fresh = path.join(root, '.tmp-fresh')
    await mkdir(stale, { recursive: true })
    await mkdir(fresh)
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    await utimes(stale, twoDaysAgo, twoDaysAgo)

    const stored = await storeLocalBuild(await androidInput(), {
      home,
      run: fakeDeviceTools().run,
      now: () => new Date(),
    })

    expect((await readdir(root)).sort()).toEqual(
      ['.tmp-fresh', stored.id].sort(),
    )
  })

  it.runIf(process.platform === 'darwin')(
    'packs a .app that the install unpacks again, with the real tar',
    async () => {
      const home = await tempDir()
      const input = await iosInput()
      const options = { home, run: runCommand, now: () => NOW }

      const stored = await storeLocalBuild(input, options)
      const app = await unpackIosBuild(stored, { ...options, cwd: home })

      expect(path.basename(app)).toBe('My App.app')
      expect(await readFile(path.join(app, 'Info.plist'), 'utf8')).toBe('plist')
    },
  )
})
