import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CommandRunner } from '../command/run-command'
import { primaryAbi } from '../devices/android'
import { runVariant } from '../cache-provider/key'
import {
  createCacheProvider,
  type CacheProviderDeps,
} from '../cache-provider/provider'
import { extractedFolder } from '../install/unpack'
import { scanStore, isLocalRecord } from '../store/builds'
import {
  NOW,
  easBuild,
  fakeDeviceTools,
  fingerprintCalls,
  localBuild,
  useTempDir,
  writeFingerprintProject,
  writeLocalBuild,
  writeStoredBuild,
  zipFile,
} from './helpers'

const HASH = '3333333333333333333333333333333333333333'
const ID_A = 'aaaa1111-0000-4000-8000-000000000001'
const ID_B = 'bbbb2222-0000-4000-8000-000000000002'
const EMULATOR_LINE =
  'emulator-5554  device product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64'
const PHONE_LINE = 'R58M12ABCDE    device usb:1-1 product:c32 model:Nokia_C32'
const ABI_LISTS = {
  'emulator-5554': 'x86_64,arm64-v8a',
  R58M12ABCDE: 'arm64-v8a,armeabi-v7a,armeabi',
}

function adbList(...lines: string[]): string {
  return ['List of devices attached', ...lines, ''].join('\n')
}

function provider(
  home: string,
  run: CommandRunner,
  extra: Partial<CacheProviderDeps> = {},
) {
  const logs: string[] = []
  const warnings: string[] = []
  const deps: CacheProviderDeps = {
    env: { DEVHUB_HOME: home },
    platform: process.platform,
    homedir: os.homedir(),
    cwd: home,
    run,
    now: () => NOW,
    arch: 'arm64',
    log: (text) => logs.push(text),
    warn: (text) => warnings.push(text),
    readAppConfig: () => ({}),
    ...extra,
  }
  return { plugin: createCacheProvider(deps), logs, warnings }
}

function androidRun(
  options: { devices?: string; abiLists?: Record<string, string> } = {},
) {
  return fakeDeviceTools({
    devices: options.devices ?? adbList(EMULATOR_LINE),
    avdNames: { 'emulator-5554': 'Pixel_Light_34' },
    abiLists: options.abiLists ?? ABI_LISTS,
  })
}

const ANDROID = {
  projectRoot: '/work/my-app',
  platform: 'android',
  fingerprintHash: HASH,
  runOptions: {},
}

describe('primaryAbi', () => {
  it('takes the first ABI that Expo CLI builds for', () => {
    expect(primaryAbi('x86_64,arm64-v8a\n')).toBe('x86_64')
    expect(primaryAbi('armeabi,armeabi-v7a')).toBe('armeabi-v7a')
    expect(primaryAbi('mips\n')).toBeUndefined()
    expect(primaryAbi('')).toBeUndefined()
  })
})

describe('runVariant', () => {
  it('uses the defaults of Expo CLI', () => {
    expect(runVariant('android', {})).toEqual({
      kind: 'known',
      variant: 'debug',
    })
    expect(runVariant('android', { variant: 'release' })).toEqual({
      kind: 'known',
      variant: 'release',
    })
    expect(runVariant('ios', { scheme: undefined })).toEqual({
      kind: 'known',
      variant: 'Debug',
    })
    expect(runVariant('ios', { configuration: 'Release' })).toEqual({
      kind: 'known',
      variant: 'Release',
    })
  })

  it('does not know the build of a run with --scheme', () => {
    expect(runVariant('ios', { scheme: 'MyApp' })).toMatchObject({
      kind: 'unknown',
    })
    expect(runVariant('ios', { scheme: true })).toMatchObject({
      kind: 'unknown',
    })
  })
})

describe('calculateFingerprintHash', () => {
  const tempDir = useTempDir()

  it('gives the hash of one platform, and calculates it one time in a run', async () => {
    const project = await writeFingerprintProject(await tempDir(), {
      hashes: { android: HASH, ios: '4444' },
    })
    const { plugin } = provider(await tempDir(), fakeDeviceTools().run)
    const props = { projectRoot: project, platform: 'android', runOptions: {} }

    expect(await plugin.calculateFingerprintHash(props)).toBe(HASH)
    expect(await plugin.calculateFingerprintHash(props)).toBe(HASH)
    expect(
      await plugin.calculateFingerprintHash({ ...props, platform: 'ios' }),
    ).toBe('4444')
    expect(await fingerprintCalls(project)).toEqual([
      {
        projectRoot: project,
        options: { platforms: ['android'], silent: true },
      },
      { projectRoot: project, options: { platforms: ['ios'], silent: true } },
    ])
  })

  it('gives a warning and no hash when the fingerprint fails', async () => {
    const project = await writeFingerprintProject(await tempDir(), {
      failure: 'bad config',
    })
    const { plugin, warnings } = provider(
      await tempDir(),
      fakeDeviceTools().run,
    )

    expect(
      await plugin.calculateFingerprintHash({
        projectRoot: project,
        platform: 'android',
        runOptions: {},
      }),
    ).toBeNull()
    expect(warnings).toEqual([
      `DevHub cannot calculate the fingerprint. @expo/fingerprint failed for android in ${project}: bad config. Expo CLI does not use the DevHub store in this run.`,
    ])
  })

  it('gives no hash for a platform that is not android or ios', async () => {
    const { plugin } = provider(await tempDir(), fakeDeviceTools().run)

    expect(
      await plugin.calculateFingerprintHash({
        projectRoot: '/work/my-app',
        platform: 'web',
        runOptions: {},
      }),
    ).toBeNull()
  })
})

describe('resolveBuildCache for Android', () => {
  const tempDir = useTempDir()

  it('returns the newest local build that fits the ready device', async () => {
    const home = await tempDir()
    await writeLocalBuild(home, ID_A, localBuild({ fingerprintHash: HASH }))
    const newer = await writeLocalBuild(
      home,
      ID_B,
      localBuild({ fingerprintHash: HASH }),
      'app.apk',
      new Date('2026-10-18T09:00:00.000Z'),
    )
    const { plugin, logs, warnings } = provider(home, androidRun().run)

    expect(await plugin.resolveBuildCache(ANDROID)).toBe(newer)
    expect(logs).toEqual([
      'Expo CLI installs the stored build bbbb2222, and does not build the app.',
    ])
    expect(warnings).toEqual([])
  })

  it('does not serve an EAS build, or a build of another variant', async () => {
    const home = await tempDir()
    await writeStoredBuild(
      home,
      easBuild({ id: ID_A, fingerprint: { hash: HASH } }),
    )
    await writeLocalBuild(
      home,
      ID_B,
      localBuild({ fingerprintHash: HASH, variant: 'release' }),
    )
    const { plugin, logs } = provider(home, androidRun().run)

    expect(await plugin.resolveBuildCache(ANDROID)).toBeNull()
    expect(logs).toEqual([
      'No stored build has the android fingerprint 33333333 and the variant debug. Expo CLI builds the app, and DevHub stores the build.',
    ])
  })

  it('does not serve a build that has no native code for a ready device', async () => {
    const home = await tempDir()
    await writeLocalBuild(home, ID_A, localBuild({ fingerprintHash: HASH }))
    const { plugin, logs } = provider(
      home,
      androidRun({ devices: adbList(EMULATOR_LINE, PHONE_LINE) }).run,
    )

    expect(await plugin.resolveBuildCache(ANDROID)).toBeNull()
    expect(logs).toEqual([
      'The stored build aaaa1111 has the same fingerprint, but no native code for Nokia C32 (arm64-v8a). Expo CLI builds the app.',
    ])
  })

  it('checks only the device that --device names', async () => {
    const home = await tempDir()
    const file = await writeLocalBuild(
      home,
      ID_A,
      localBuild({ fingerprintHash: HASH }),
    )
    const { plugin } = provider(
      home,
      androidRun({ devices: adbList(EMULATOR_LINE, PHONE_LINE) }).run,
    )

    for (const device of ['Pixel_Light_34', 'emulator-5554']) {
      expect(
        await plugin.resolveBuildCache({ ...ANDROID, runOptions: { device } }),
      ).toBe(file)
    }
    expect(
      await plugin.resolveBuildCache({
        ...ANDROID,
        runOptions: { device: 'Nokia_C32' },
      }),
    ).toBeNull()
  })

  it('needs each ABI for a run with --all-arch', async () => {
    const home = await tempDir()
    await writeLocalBuild(home, ID_A, localBuild({ fingerprintHash: HASH }))
    const all = await writeLocalBuild(
      home,
      ID_B,
      localBuild({
        fingerprintHash: HASH,
        abis: ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'],
      }),
      'app.apk',
      new Date('2026-10-01T00:00:00.000Z'),
    )
    const { plugin } = provider(home, androidRun().run)

    expect(
      await plugin.resolveBuildCache({
        ...ANDROID,
        runOptions: { allArch: true },
      }),
    ).toBe(all)
  })

  it('serves an APK with no native code on each device', async () => {
    const home = await tempDir()
    const file = await writeLocalBuild(
      home,
      ID_A,
      localBuild({ fingerprintHash: HASH, abis: [] }),
    )
    const { plugin } = provider(
      home,
      androidRun({ devices: adbList(EMULATOR_LINE, PHONE_LINE) }).run,
    )

    expect(await plugin.resolveBuildCache(ANDROID)).toBe(file)
  })

  it('builds when the device is not known', async () => {
    const home = await tempDir()
    await writeLocalBuild(home, ID_A, localBuild({ fingerprintHash: HASH }))
    const cases: [ReturnType<typeof androidRun>, unknown, string][] = [
      [
        androidRun({ devices: adbList() }),
        undefined,
        'No Android device is ready.',
      ],
      [
        androidRun(),
        'Pixel_9',
        'No ready Android device has the name or the serial "Pixel_9".',
      ],
      [
        androidRun({ abiLists: {} }),
        undefined,
        'DevHub cannot read the ABI of Pixel_Light_34 (emulator-5554).',
      ],
    ]
    for (const [tools, device, reason] of cases) {
      const { plugin, logs } = provider(home, tools.run)

      expect(
        await plugin.resolveBuildCache({ ...ANDROID, runOptions: { device } }),
      ).toBeNull()
      expect(logs).toEqual([`${reason} Expo CLI builds the app.`])
    }
  })

  it('skips a record whose file is gone', async () => {
    const home = await tempDir()
    const file = await writeLocalBuild(
      home,
      ID_A,
      localBuild({ fingerprintHash: HASH }),
    )
    await rm(file)
    const { plugin, logs } = provider(home, androidRun().run)

    expect(await plugin.resolveBuildCache(ANDROID)).toBeNull()
    expect(logs[0]).toContain('No stored build has the android fingerprint')
  })

  it('gives a warning, not an error, when adb does not start', async () => {
    const home = await tempDir()
    await writeLocalBuild(home, ID_A, localBuild({ fingerprintHash: HASH }))
    const { plugin, warnings } = provider(
      home,
      fakeDeviceTools({ adbMissing: true }).run,
    )

    expect(await plugin.resolveBuildCache(ANDROID)).toBeNull()
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(
      /^DevHub cannot look for a stored build\. DevHub cannot find adb\..* Expo CLI builds the app\.$/,
    )
  })
})

describe('resolveBuildCache for iOS', () => {
  const tempDir = useTempDir()
  const IOS = { ...ANDROID, platform: 'ios' }
  const iosBuild = (hostArch: string) =>
    localBuild({
      platform: 'IOS',
      variant: 'Debug',
      fingerprintHash: HASH,
      abis: undefined,
      hostArch,
    })

  it('returns the unpacked .app of a build from a Mac of the same architecture', async () => {
    const home = await tempDir()
    await writeLocalBuild(home, ID_A, iosBuild('x64'), 'app.tar.gz')
    await writeLocalBuild(
      home,
      ID_B,
      iosBuild('arm64'),
      'app.tar.gz',
      new Date('2026-10-01T00:00:00.000Z'),
    )
    const tools = fakeDeviceTools({ archive: ['My App.app'] })
    const { plugin, logs } = provider(home, tools.run)

    expect(await plugin.resolveBuildCache(IOS)).toBe(
      path.join(extractedFolder(home, ID_B), 'My App.app'),
    )
    expect(logs).toEqual([
      'Expo CLI installs the stored build bbbb2222, and does not build the app.',
    ])
  })

  it('builds when only a Mac of another architecture made the build', async () => {
    const home = await tempDir()
    await writeLocalBuild(home, ID_A, iosBuild('x64'), 'app.tar.gz')
    const { plugin, logs } = provider(home, fakeDeviceTools().run)

    expect(await plugin.resolveBuildCache(IOS)).toBeNull()
    expect(logs).toEqual([
      'The stored build aaaa1111 has the same fingerprint, but a Mac with the architecture x64 made it. Expo CLI builds the app.',
    ])
  })

  it('builds when the run gives --scheme', async () => {
    const home = await tempDir()
    await writeLocalBuild(home, ID_A, iosBuild('arm64'), 'app.tar.gz')
    const { plugin, logs } = provider(home, fakeDeviceTools().run)

    expect(
      await plugin.resolveBuildCache({
        ...IOS,
        runOptions: { scheme: 'MyApp' },
      }),
    ).toBeNull()
    expect(logs).toEqual([
      'The run gives --scheme, and a stored build does not record its scheme. Expo CLI builds the app.',
    ])
  })
})

describe('uploadBuildCache', () => {
  const tempDir = useTempDir()

  async function apk(abis: readonly string[]) {
    const file = path.join(await tempDir(), 'app-debug.apk')
    await writeFile(file, zipFile(abis.map((abi) => `lib/${abi}/libhermes.so`)))
    return file
  }

  it('stores the APK with the key, the app config, and the git commit', async () => {
    const home = await tempDir()
    const project = await tempDir()
    const buildPath = await apk(['x86_64'])
    const commit = '0123456789abcdef0123456789abcdef01234567'
    const tools = fakeDeviceTools({
      git: { code: 0, stdout: `${commit}\n`, stderr: '' },
    })
    const { plugin, logs, warnings } = provider(home, tools.run, {
      readAppConfig: (_root, platform) => ({
        slug: 'my-app',
        appIdentifier: `com.example.${platform}`,
        appVersion: '1.2.0',
      }),
    })

    const stored = await plugin.uploadBuildCache({
      ...ANDROID,
      projectRoot: project,
      buildPath,
    })

    const [build] = (await scanStore(home)).builds
    expect(stored).toBe(build?.path)
    expect(await readFile(stored ?? '')).toEqual(await readFile(buildPath))
    expect(build && isLocalRecord(build.record) && build.record.local).toEqual({
      platform: 'ANDROID',
      fingerprintHash: HASH,
      variant: 'debug',
      project: await realpath(project),
      slug: 'my-app',
      appIdentifier: 'com.example.android',
      appVersion: '1.2.0',
      gitCommitHash: commit,
      abis: ['x86_64'],
    })
    expect(tools.calls).toContainEqual(['git', 'rev-parse', 'HEAD'])
    expect(logs).toEqual([
      `Stored the build ${build?.id.slice(0, 8)} in the DevHub store.`,
    ])
    expect(warnings).toEqual([])
  })

  it('stores no second copy of a build that the store has', async () => {
    const home = await tempDir()
    const existing = await writeLocalBuild(
      home,
      ID_A,
      localBuild({ fingerprintHash: HASH, abis: ['arm64-v8a', 'x86_64'] }),
    )
    const { plugin, logs } = provider(home, fakeDeviceTools().run)

    expect(
      await plugin.uploadBuildCache({
        ...ANDROID,
        projectRoot: await tempDir(),
        buildPath: await apk(['x86_64']),
      }),
    ).toBe(existing)
    expect((await scanStore(home)).builds).toHaveLength(1)
    expect(logs).toEqual([
      'The DevHub store has this build already (aaaa1111). DevHub does not store it again.',
    ])
  })

  it('stores a build for a device that the stored build does not fit', async () => {
    const home = await tempDir()
    await writeLocalBuild(home, ID_A, localBuild({ fingerprintHash: HASH }))
    const { plugin } = provider(home, fakeDeviceTools().run)

    await plugin.uploadBuildCache({
      ...ANDROID,
      projectRoot: await tempDir(),
      buildPath: await apk(['arm64-v8a']),
    })

    expect((await scanStore(home)).builds).toHaveLength(2)
  })

  it('stores an iOS build with the architecture of the Mac', async () => {
    const home = await tempDir()
    const app = path.join(await tempDir(), 'My App.app')
    await mkdir(app)
    const { plugin } = provider(home, fakeDeviceTools().run, { arch: 'x64' })

    await plugin.uploadBuildCache({
      ...ANDROID,
      platform: 'ios',
      projectRoot: await tempDir(),
      buildPath: app,
    })

    const [build] = (await scanStore(home)).builds
    expect(build?.record).toMatchObject({
      file: 'app.tar.gz',
      local: { platform: 'IOS', variant: 'Debug', hostArch: 'x64' },
    })
  })

  it('does not store the build of a run with --scheme', async () => {
    const home = await tempDir()
    const { plugin, logs } = provider(home, fakeDeviceTools().run)

    expect(
      await plugin.uploadBuildCache({
        ...ANDROID,
        platform: 'ios',
        runOptions: { scheme: 'MyApp' },
        buildPath: '/build/My App.app',
      }),
    ).toBeNull()
    expect(logs).toEqual([
      'DevHub does not store this build. The run gives --scheme, and a stored build does not record its scheme.',
    ])
  })

  it('gives a warning, not an error, when it cannot store the build', async () => {
    const home = await tempDir()
    const { plugin, warnings } = provider(home, fakeDeviceTools().run)

    expect(
      await plugin.uploadBuildCache({
        ...ANDROID,
        projectRoot: await tempDir(),
        buildPath: path.join(await tempDir(), 'missing.apk'),
      }),
    ).toBeNull()
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/^DevHub cannot store the build\. ENOENT/)
    expect((await scanStore(home)).builds).toEqual([])
  })
})

describe('uploadBuildCache, then resolveBuildCache', () => {
  const tempDir = useTempDir()

  it('serves the build that the first run stored to the second run', async () => {
    const home = await tempDir()
    const project = await tempDir()
    const buildPath = path.join(project, 'app-debug.apk')
    await writeFile(buildPath, zipFile(['lib/x86_64/libhermes.so']))
    const tools = androidRun()

    const first = provider(home, tools.run)
    expect(await first.plugin.resolveBuildCache(ANDROID)).toBeNull()
    const stored = await first.plugin.uploadBuildCache({
      ...ANDROID,
      projectRoot: project,
      buildPath,
    })

    const second = provider(home, tools.run)
    expect(await second.plugin.resolveBuildCache(ANDROID)).toBe(stored)
  })
})
