import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { runCommand } from '../command/run-command'
import { DeviceError } from '../devices/device'
import {
  TAR_MISSING,
  extractedFolder,
  extractedRoot,
  tarExtractCommand,
  unpackIosBuild,
} from '../install/unpack'
import { EAS_RECORD_SCHEMA_VERSION, type StoredBuild } from '../store/builds'
import { NOW, easBuild, fakeDeviceTools, useTempDir } from './helpers'

const ID = 'aaaa1111-0000-4000-8000-000000000001'

function simulatorBuild(home: string): StoredBuild {
  const file = 'app.tar.gz'
  return {
    id: ID,
    path: path.join(home, 'builds', ID, file),
    record: {
      schemaVersion: EAS_RECORD_SCHEMA_VERSION,
      storedAt: NOW.toISOString(),
      file,
      size: 6,
      sha256: '0'.repeat(64),
      eas: easBuild({ id: ID, platform: 'IOS', isForIosSimulator: true }),
    },
  }
}

describe('tarExtractCommand', () => {
  it('keeps a path with a space as one argument', () => {
    expect(tarExtractCommand('/My Store/app.tar.gz', '/out dir')).toEqual([
      'tar',
      '-xf',
      '/My Store/app.tar.gz',
      '-C',
      '/out dir',
    ])
  })
})

describe('unpackIosBuild', () => {
  const tempDir = useTempDir()

  async function setup(tools = fakeDeviceTools()) {
    const home = await tempDir()
    const build = simulatorBuild(home)
    const unpack = () =>
      unpackIosBuild(build, { run: tools.run, cwd: home, home })
    return { home, build, tools, unpack }
  }

  it('unpacks into a temporary folder, and renames it last', async () => {
    const { home, build, tools, unpack } = await setup()

    const app = await unpack()

    expect(app).toBe(path.join(extractedFolder(home, ID), 'My App.app'))
    expect((await stat(path.join(app, 'Info.plist'))).isFile()).toBe(true)
    const [command] = tools.calls
    expect(command?.slice(0, 4)).toEqual(['tar', '-xf', build.path, '-C'])
    const temp = command?.[4] ?? ''
    expect(path.dirname(temp)).toBe(extractedRoot(home))
    expect(temp).not.toBe(extractedFolder(home, ID))
    expect(await readdir(extractedRoot(home))).toEqual([ID])
  })

  it('unpacks one time, and then uses the folder again', async () => {
    const { tools, unpack } = await setup()

    const first = await unpack()
    const second = await unpack()

    expect(second).toBe(first)
    expect(tools.calls).toHaveLength(1)
  })

  it('finds an .app in a subfolder, and does not count a watch app', async () => {
    const { home, unpack } = await setup(
      fakeDeviceTools({
        archive: ['Payload/My App.app', 'Payload/My App.app/Watch/Watch.app'],
      }),
    )

    expect(await unpack()).toBe(
      path.join(extractedFolder(home, ID), 'Payload', 'My App.app'),
    )
  })

  it('unpacks again when the folder in the cache has no .app', async () => {
    const { home, tools, unpack } = await setup()
    const folder = extractedFolder(home, ID)
    await mkdir(folder, { recursive: true })
    await writeFile(path.join(folder, 'notes.txt'), 'x')

    expect(await unpack()).toBe(path.join(folder, 'My App.app'))
    expect(tools.calls).toHaveLength(1)
    expect(await readdir(folder)).toEqual(['My App.app'])
  })

  it.each([
    [[], 'has no .app folder, so it is not an iOS simulator build.'],
    [
      ['First.app', 'Second.app'],
      'has 2 .app folders. DevHub installs a build with exactly one .app:\n  First.app\n  Second.app',
    ],
  ])('refuses an archive with the folders %j', async (archive, reason) => {
    const { home, unpack } = await setup(fakeDeviceTools({ archive }))

    await expect(unpack()).rejects.toThrow(
      `The archive app.tar.gz of the build ${ID} ${reason}`,
    )
    expect(await readdir(extractedRoot(home))).toEqual([])
  })

  it('reports a failed tar, and leaves no folder', async () => {
    const { home, build, unpack } = await setup(
      fakeDeviceTools({
        tarFailure: { code: 1, stderr: 'tar: Error opening archive' },
      }),
    )

    await expect(unpack()).rejects.toThrow(
      `"tar" cannot unpack the build ${ID}, and failed with exit code 1. The stored file can be damaged. Delete the folder ${path.dirname(build.path)}, and then run devhub sync in the project to download the build again.\ntar: Error opening archive`,
    )
    expect(await readdir(extractedRoot(home))).toEqual([])
  })

  it('gives the fix when tar does not start', async () => {
    const home = await tempDir()
    const missing = async () => {
      throw Object.assign(new Error('spawn tar ENOENT'), { code: 'ENOENT' })
    }

    await expect(
      unpackIosBuild(simulatorBuild(home), { run: missing, cwd: home, home }),
    ).rejects.toThrow(new DeviceError(TAR_MISSING))
  })

  it.runIf(process.platform === 'darwin')(
    'unpacks a real archive with the real tar',
    async () => {
      const home = await tempDir()
      const build = simulatorBuild(home)
      const source = path.join(home, 'source')
      await mkdir(path.join(source, 'Real App.app'), { recursive: true })
      await writeFile(path.join(source, 'Real App.app', 'Info.plist'), 'x')
      await mkdir(path.dirname(build.path), { recursive: true })
      const packed = await runCommand(
        ['tar', '-czf', build.path, '-C', source, 'Real App.app'],
        { cwd: home },
      )
      expect(packed.code).toBe(0)

      const app = await unpackIosBuild(build, {
        run: runCommand,
        cwd: home,
        home,
      })

      expect(app).toBe(path.join(extractedFolder(home, ID), 'Real App.app'))
      expect((await stat(path.join(app, 'Info.plist'))).isFile()).toBe(true)
    },
  )
})
