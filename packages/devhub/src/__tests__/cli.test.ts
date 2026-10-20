import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import pkg from '../../package.json' with { type: 'json' }
import { EXIT_CODE, run } from '../cli/run'
import type { EasBuild } from '../eas/build'
import { buildFolder } from '../store/builds'
import {
  capture,
  easBuild,
  fingerprintCalls,
  fakeDeviceTools,
  fakeDownload,
  fakeEas,
  testContext,
  useTempDir,
  localBuild,
  writeFingerprintProject,
  writeLocalBuild,
  writeProject,
  writeStoredBuild,
} from './helpers'

const ID_A = 'aaaa1111-0000-4000-8000-000000000001'
const ID_B = 'bbbb2222-0000-4000-8000-000000000002'
const ID_C = 'cccc3333-0000-4000-8000-000000000003'

describe('devhub CLI', () => {
  it.each([['--version'], ['-v']])(
    '%s prints the package version',
    async (flag) => {
      const { io, out, err } = capture()

      expect(await run([flag], { io })).toBe(EXIT_CODE.ok)
      expect(out).toEqual([pkg.version])
      expect(err).toEqual([])
    },
  )

  it.each([[[]], [['--help']], [['-h']]])(
    'args %j print the help',
    async (argv) => {
      const { io, out, err } = capture()

      expect(await run(argv, { io })).toBe(EXIT_CODE.ok)
      expect(out.join('\n')).toContain('Usage: devhub <command>')
      expect(err).toEqual([])
    },
  )

  it.each([
    ['sync'],
    ['list'],
    ['where'],
    ['devices'],
    ['install'],
    ['ui'],
    ['whoami'],
  ])('devhub %s --help prints the help of the command', async (command) => {
    const { io, out } = capture()

    expect(await run([command, '--help'], { io })).toBe(EXIT_CODE.ok)
    expect(out.join('\n')).toContain(`Usage: devhub ${command}`)
  })

  it.each([
    [['launch'], 'Unknown command "launch"', 'devhub --help'],
    [['toString'], 'Unknown command "toString"', 'devhub --help'],
    [['--nope'], '--nope', 'devhub --help'],
    [['list', '--all'], '--all', 'devhub list --help'],
    [['list', 'extra'], 'takes no arguments', 'devhub list --help'],
    [['sync', 'now'], 'takes no arguments', 'devhub sync --help'],
    [['sync', '--profile'], '--profile', 'devhub sync --help'],
    [['where'], 'needs a build ID', 'devhub where --help'],
    [['where', 'a', 'b'], 'takes one build ID', 'devhub where --help'],
    [['devices', 'extra'], 'takes no arguments', 'devhub devices --help'],
    [['install'], 'needs a build ID', 'devhub install --help'],
    [['install', 'a', 'b'], 'takes one build ID', 'devhub install --help'],
    [['ui', 'extra'], 'takes no arguments', 'devhub ui --help'],
    [['ui', '--port', 'abc'], 'is not valid', 'devhub ui --help'],
    [['ui', '--port', '65536'], 'is not valid', 'devhub ui --help'],
    [['ui', '--port', '1e3'], 'is not valid', 'devhub ui --help'],
  ])('args %j give a usage error', async (argv, message, help) => {
    const { io, out, err } = capture()

    expect(await run(argv, { io })).toBe(EXIT_CODE.usage)
    expect(out).toEqual([])
    expect(err.join('\n')).toContain(message)
    expect(err.join('\n')).toContain(`Run "${help}"`)
  })
})

describe('devhub list', () => {
  const tempDir = useTempDir()

  it('shows the stored builds by project, newest first', async () => {
    const home = await tempDir()
    await writeStoredBuild(
      home,
      easBuild({
        id: ID_A,
        app: { slug: 'zoo' },
        createdAt: '2026-10-02T09:00:00.000Z',
      }),
    )
    await writeStoredBuild(
      home,
      easBuild({
        id: ID_B,
        platform: 'IOS',
        isForIosSimulator: true,
        buildProfile: 'development-simulator',
        appVersion: '2.1.0',
        createdAt: '2026-10-05T09:00:00.000Z',
        expirationDate: '2026-11-04T09:00:00.000Z',
      }),
    )
    await writeStoredBuild(
      home,
      easBuild({
        id: ID_C,
        platform: 'IOS',
        gitCommitHash: undefined,
        createdAt: '2026-09-01T09:00:00.000Z',
      }),
    )
    const { io, out, err } = capture()

    expect(await run(['list'], testContext({ io, home }))).toBe(EXIT_CODE.ok)

    expect(out.join('\n')).toBe(
      [
        'ID        PROJECT  PLATFORM       PROFILE                VERSION  COMMIT   CREATED     EAS EXPIRY',
        'bbbb2222  my-app   ios simulator  development-simulator  2.1.0    0123456  2026-10-05  2026-11-04',
        'cccc3333  my-app   ios device     development            1.0.0    -        2026-09-01  2026-10-31',
        'aaaa1111  zoo      android        development            1.0.0    0123456  2026-10-02  2026-10-31',
      ].join('\n'),
    )
    expect(err).toEqual([])
  })

  it('prints the builds as JSON with the path and the EAS record', async () => {
    const home = await tempDir()
    const build = easBuild({ id: ID_A })
    const file = await writeStoredBuild(home, build)
    await mkdir(buildFolder(home, ID_B), { recursive: true })
    const { io, out, err } = capture()

    expect(await run(['list', '--json'], testContext({ io, home }))).toBe(
      EXIT_CODE.ok,
    )

    expect(JSON.parse(out.join('\n'))).toEqual({
      builds: [
        {
          id: ID_A,
          source: 'eas',
          path: file,
          size: 6,
          sha256: expect.any(String),
          storedAt: expect.any(String),
          eas: build,
        },
      ],
      incomplete: [ID_B],
      unreadable: [],
    })
    expect(err.join('\n')).toContain('1 incomplete build folder')
  })

  it('tells what to do when the store is empty', async () => {
    const home = await tempDir()
    const { io, out } = capture()

    expect(await run(['list'], testContext({ io, home }))).toBe(EXIT_CODE.ok)
    expect(out).toEqual([
      'The store has no builds. Run devhub sync in a project folder.',
    ])
  })

  it('shows longer IDs when 8 characters do not make each one unique', async () => {
    const home = await tempDir()
    await writeStoredBuild(
      home,
      easBuild({ id: 'abcd1234-5678-4000-8000-000000000001' }),
    )
    await writeStoredBuild(
      home,
      easBuild({ id: 'abcd1234-5699-4000-8000-000000000002' }),
    )
    const { io, out } = capture()

    await run(['list'], testContext({ io, home }))

    const ids = out
      .join('\n')
      .split('\n')
      .slice(1)
      .map((line) => line.split(' ')[0])
    expect(ids.sort()).toEqual(['abcd1234-567', 'abcd1234-569'])
  })
})

describe('devhub list with local builds', () => {
  const tempDir = useTempDir()

  it('shows a local build with its variant and no EAS expiry', async () => {
    const home = await tempDir()
    await writeStoredBuild(home, easBuild({ id: ID_A }))
    await writeLocalBuild(home, ID_B, localBuild())
    await writeLocalBuild(
      home,
      ID_C,
      localBuild({ platform: 'IOS', variant: 'Debug', slug: undefined }),
      'app.tar.gz',
    )
    const { io, out } = capture()

    expect(await run(['list'], testContext({ io, home }))).toBe(EXIT_CODE.ok)

    expect(out.join('\n')).toBe(
      [
        'ID        PROJECT  PLATFORM       PROFILE      VERSION  COMMIT   CREATED     EAS EXPIRY',
        'bbbb2222  my-app   android        local debug  1.2.0    89abcde  2026-10-17  -',
        'cccc3333  my-app   ios simulator  local Debug  1.2.0    89abcde  2026-10-17  -',
        'aaaa1111  my-app   android        development  1.0.0    0123456  2026-10-01  2026-10-31',
      ].join('\n'),
    )
  })

  it('finds the file of a local build with where', async () => {
    const home = await tempDir()
    const file = await writeLocalBuild(home, ID_B, localBuild())
    const { io, out } = capture()

    expect(await run(['where', 'bbbb'], testContext({ io, home }))).toBe(
      EXIT_CODE.ok,
    )
    expect(out).toEqual([file])
  })
})

describe('devhub where', () => {
  const tempDir = useTempDir()

  async function store() {
    const home = await tempDir()
    const fileA = await writeStoredBuild(home, easBuild({ id: ID_A }))
    await writeStoredBuild(
      home,
      easBuild({ id: 'aaaa1199-0000-4000-8000-000000000009' }),
    )
    return { home, fileA }
  }

  it('prints the path of the build with a unique prefix', async () => {
    const { home, fileA } = await store()
    const { io, out } = capture()

    expect(await run(['where', 'aaaa1111'], testContext({ io, home }))).toBe(
      EXIT_CODE.ok,
    )
    expect(out).toEqual([fileA])
  })

  it('prints the ID and the path as JSON', async () => {
    const { home, fileA } = await store()
    const { io, out } = capture()

    await run(['where', ID_A, '--json'], testContext({ io, home }))

    expect(JSON.parse(out.join('\n'))).toEqual({ id: ID_A, path: fileA })
  })

  it('lists the matches of a prefix that is not unique', async () => {
    const { home } = await store()
    const { io, out, err } = capture()

    expect(await run(['where', 'aaaa11'], testContext({ io, home }))).toBe(
      EXIT_CODE.failure,
    )
    expect(out).toEqual([])
    expect(err.join('\n')).toContain('matches 2 stored builds')
    expect(err.join('\n')).toContain(ID_A)
  })

  it('fails for an ID that is not stored', async () => {
    const { home } = await store()
    const { io, err } = capture()

    expect(await run(['where', 'ffff'], testContext({ io, home }))).toBe(
      EXIT_CODE.failure,
    )
    expect(err.join('\n')).toContain('Run devhub list')
  })

  it('fails when the build file is missing', async () => {
    const { home, fileA } = await store()
    await rm(fileA)
    const { io, out, err } = capture()

    expect(await run(['where', 'aaaa1111'], testContext({ io, home }))).toBe(
      EXIT_CODE.failure,
    )
    expect(out).toEqual([])
    expect(err.join('\n')).toContain('the file does not exist')
  })
})

describe('devhub sync', () => {
  const tempDir = useTempDir()

  async function setup() {
    const root = await tempDir()
    const home = path.join(root, 'home')
    const project = await writeProject(path.join(root, 'app'), {
      build: { development: { developmentClient: true } },
    })
    return { root, home, project }
  }

  it('syncs the project of the current folder, and reports the result', async () => {
    const { home, project } = await setup()
    const nested = path.join(project, 'src')
    await mkdir(nested)
    const eas = fakeEas({
      development: [
        easBuild({ id: ID_A }),
        easBuild({ id: ID_B, expirationDate: '2026-01-01T00:00:00.000Z' }),
      ],
    })
    const { io, out, err } = capture()

    const code = await run(
      ['sync'],
      testContext({
        io,
        home,
        cwd: nested,
        run: eas.run,
        download: fakeDownload(),
      }),
    )

    expect(code).toBe(EXIT_CODE.ok)
    const text = out.join('\n')
    expect(text).toContain('Profiles: development (android, ios)')
    expect(text).toMatch(
      /Downloaded {2}aaaa1111 {2}android {2}development {2}1\.0\.0/,
    )
    expect(text).toContain('1 downloaded (')
    expect(text).toContain('1 build expired before sync.')
    expect(text).not.toContain('bbbb2222')
    expect(err.join('\n')).toContain('Downloading the build')
  })

  it('prints the report as JSON with --json', async () => {
    const { home, project } = await setup()
    const eas = fakeEas({ development: [easBuild({ id: ID_A })] })
    const { io, out } = capture()

    await run(
      ['sync', '--json', '--dry-run'],
      testContext({ io, home, cwd: project, run: eas.run }),
    )

    const report = JSON.parse(out.join('\n'))
    expect(report.dryRun).toBe(true)
    expect(report.projects[0].builds[0]).toMatchObject({
      id: ID_A,
      status: 'would-download',
      profile: 'development',
      platform: 'ANDROID',
    })
  })

  it('fails with the next step outside an EAS project', async () => {
    const root = await tempDir()
    const { io, err } = capture()

    const code = await run(
      ['sync'],
      testContext({
        io,
        home: path.join(root, 'home'),
        cwd: root,
        run: fakeEas({}).run,
      }),
    )

    expect(code).toBe(EXIT_CODE.failure)
    expect(err.join('\n')).toContain('have no eas.json')
  })

  it('fails with the next step when eas has no login', async () => {
    const { home, project } = await setup()
    const eas = fakeEas({}, { whoami: { code: 1, stderr: 'Not logged in' } })
    const { io, out, err } = capture()

    const code = await run(
      ['sync'],
      testContext({ io, home, cwd: project, run: eas.run }),
    )

    expect(code).toBe(EXIT_CODE.failure)
    expect(out).toEqual([])
    expect(err.join('\n')).toContain('Run "eas login"')
  })

  it('syncs each known project with --all, and exits 1 when one fails', async () => {
    const { root, home, project } = await setup()
    const broken = await writeProject(path.join(root, 'broken'), '{ build: ')
    const eas = fakeEas({ development: [easBuild({ id: ID_A })] })
    const context = (io: ReturnType<typeof capture>['io'], cwd: string) =>
      testContext({ io, home, cwd, run: eas.run, download: fakeDownload() })

    await run(['sync'], context(capture().io, project))
    await writeFile(
      path.join(home, 'projects.json'),
      JSON.stringify({
        schemaVersion: 1,
        projects: [
          { path: project },
          { path: broken },
          { path: path.join(root, 'gone') },
        ],
      }),
    )
    const { io, out, err } = capture()

    const code = await run(['sync', '--all'], context(io, root))

    expect(code).toBe(EXIT_CODE.failure)
    const text = out.join('\n')
    expect(text).toContain('1 already stored.')
    expect(text).toContain(`${broken}\n  Failed. `)
    expect(text).toContain('Skipped. The folder does not exist.')
    expect(err.join('\n')).toContain('Warning: The project folder')
  })

  it('tells what to do when --all knows no project', async () => {
    const root = await tempDir()
    const { io, out, err } = capture()

    const code = await run(
      ['sync', '--all', '--json'],
      testContext({
        io,
        home: path.join(root, 'home'),
        cwd: root,
        run: fakeEas({}).run,
      }),
    )

    expect(code).toBe(EXIT_CODE.ok)
    expect(JSON.parse(out.join('\n'))).toEqual({ dryRun: false, projects: [] })
    expect(err.join('\n')).toContain(
      'Run devhub sync in a project folder first.',
    )
  })
})

describe('devhub devices', () => {
  const ADB_OUTPUT = [
    'List of devices attached',
    'emulator-5554  device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a transport_id:1',
    'R58M12ABCDE    unauthorized usb:1-1 transport_id:2',
    '',
  ].join('\n')

  it('shows each device, and a note for a device that is not ready', async () => {
    const { io, out, err } = capture()
    const adb = fakeDeviceTools({
      devices: ADB_OUTPUT,
      avdNames: { 'emulator-5554': 'Pixel_8_API_35' },
    })

    expect(
      await run(
        ['devices'],
        testContext({ io, home: '/unused', platform: 'linux', run: adb.run }),
      ),
    ).toBe(EXIT_CODE.ok)
    expect(out.join('\n').split('\n')).toEqual([
      expect.stringMatching(/^ID\s+PLATFORM\s+KIND\s+NAME\s+STATE$/),
      expect.stringMatching(
        /^emulator-5554\s+android\s+emulator\s+Pixel_8_API_35\s+ready$/,
      ),
      expect.stringMatching(
        /^R58M12ABCDE\s+android\s+physical\s+R58M12ABCDE\s+unauthorized$/,
      ),
    ])
    expect(err).toEqual([
      'Note: the device R58M12ABCDE is not ready. Unlock the device, and accept the USB debugging prompt on it.',
    ])
  })

  it('prints the devices as JSON', async () => {
    const { io, out } = capture()
    const adb = fakeDeviceTools({ devices: ADB_OUTPUT })

    expect(
      await run(
        ['devices', '--json'],
        testContext({ io, home: '/unused', platform: 'linux', run: adb.run }),
      ),
    ).toBe(EXIT_CODE.ok)
    const result = JSON.parse(out.join('\n')) as {
      devices: { id: string; ready: boolean; problem?: string }[]
      warnings: string[]
    }
    expect(result.warnings).toEqual([])
    expect(result.devices.map(({ id, ready }) => [id, ready])).toEqual([
      ['emulator-5554', true],
      ['R58M12ABCDE', false],
    ])
    expect(result.devices[1]?.problem).toContain('USB debugging prompt')
  })

  it('says so when no device runs', async () => {
    const { io, out, err } = capture()

    expect(
      await run(
        ['devices'],
        testContext({
          io,
          home: '/unused',
          platform: 'linux',
          run: fakeDeviceTools().run,
        }),
      ),
    ).toBe(EXIT_CODE.ok)
    expect(out).toEqual([
      'No device runs now. Start an emulator, or connect a device with USB debugging on.',
    ])
    expect(err).toEqual([])
  })

  it.each([[[]], [['--json']]])(
    'args %j fail with the fix when adb is missing',
    async (args) => {
      const { io, out, err } = capture()
      const adb = fakeDeviceTools({ adbMissing: true })

      expect(
        await run(
          ['devices', ...args],
          testContext({ io, home: '/unused', platform: 'linux', run: adb.run }),
        ),
      ).toBe(EXIT_CODE.failure)
      expect(err.join('\n')).toContain('Warning: DevHub cannot find adb.')
      if (args.length === 0) {
        expect(out).toEqual([])
      } else {
        expect(JSON.parse(out.join('\n'))).toEqual({
          devices: [],
          warnings: [expect.stringContaining('cannot find adb')],
        })
      }
    },
  )
  const SIMULATORS = {
    devices: {
      'com.apple.CoreSimulator.SimRuntime.iOS-18-6': [
        { udid: 'AAAA-1111', name: 'iPhone 16', state: 'Booted' },
        { udid: 'BBBB-2222', name: 'iPhone 15', state: 'Shutdown' },
      ],
    },
  }

  it('also shows the booted iOS simulators on macOS', async () => {
    const { io, out } = capture()
    const tools = fakeDeviceTools({
      devices: ADB_OUTPUT,
      avdNames: { 'emulator-5554': 'Pixel_8_API_35' },
      simulators: SIMULATORS,
    })

    expect(
      await run(
        ['devices'],
        testContext({
          io,
          home: '/unused',
          platform: 'darwin',
          run: tools.run,
        }),
      ),
    ).toBe(EXIT_CODE.ok)
    expect(out.join('\n').split('\n')).toEqual([
      expect.stringMatching(/^ID\s+PLATFORM\s+KIND\s+NAME\s+STATE$/),
      expect.stringMatching(/^emulator-5554\s+android\s+emulator\s/),
      expect.stringMatching(/^R58M12ABCDE\s+android\s+physical\s/),
      expect.stringMatching(
        /^AAAA-1111\s+ios\s+simulator\s+iPhone 16 \(iOS 18\.6\)\s+ready$/,
      ),
    ])
  })

  it('lists the simulators with a warning when adb is missing on macOS', async () => {
    const { io, out, err } = capture()
    const tools = fakeDeviceTools({ adbMissing: true, simulators: SIMULATORS })

    expect(
      await run(
        ['devices'],
        testContext({
          io,
          home: '/unused',
          platform: 'darwin',
          run: tools.run,
        }),
      ),
    ).toBe(EXIT_CODE.ok)
    expect(err.join('\n')).toContain('Warning: DevHub cannot find adb.')
    expect(out.join('\n')).toContain('iPhone 16 (iOS 18.6)')
  })

  it('fails on macOS when both adb and xcrun fail', async () => {
    const { io, out, err } = capture()
    const tools = fakeDeviceTools({ adbMissing: true, xcrunMissing: true })

    expect(
      await run(
        ['devices'],
        testContext({
          io,
          home: '/unused',
          platform: 'darwin',
          run: tools.run,
        }),
      ),
    ).toBe(EXIT_CODE.failure)
    expect(out).toEqual([])
    expect(err).toEqual([
      expect.stringContaining('Warning: DevHub cannot find adb.'),
      expect.stringContaining('Warning: DevHub cannot find xcrun.'),
    ])
  })

  it('names a simulator in the message on macOS when no device runs', async () => {
    const { io, out } = capture()

    expect(
      await run(
        ['devices'],
        testContext({
          io,
          home: '/unused',
          platform: 'darwin',
          run: fakeDeviceTools().run,
        }),
      ),
    ).toBe(EXIT_CODE.ok)
    expect(out).toEqual([
      'No device runs now. Start an emulator or a simulator, or connect a device with USB debugging on.',
    ])
  })
})

describe('devhub match', () => {
  const tempDir = useTempDir()
  const ANDROID_HASH = '1111111111111111111111111111111111111111'
  const IOS_HASH = '2222222222222222222222222222222222222222'

  it('shows the matches of each platform', async () => {
    const home = await tempDir()
    const project = await writeFingerprintProject(await tempDir(), {
      hashes: { android: ANDROID_HASH, ios: IOS_HASH },
    })
    await writeStoredBuild(
      home,
      easBuild({ id: ID_A, fingerprint: { hash: ANDROID_HASH } }),
    )
    await writeStoredBuild(
      home,
      easBuild({ id: ID_B, fingerprint: { hash: 'other' } }),
    )
    const { io, out, err } = capture()

    expect(await run(['match'], testContext({ io, home, cwd: project }))).toBe(
      EXIT_CODE.ok,
    )

    expect(out.join('\n')).toBe(
      [
        `Project: ${project} (@expo/fingerprint 0.20.13)`,
        '',
        `android  ${ANDROID_HASH}`,
        '  ID        PLATFORM  PROFILE      VERSION  COMMIT   CREATED     EAS EXPIRY',
        '  aaaa1111  android   development  1.0.0    0123456  2026-10-01  2026-10-31',
        '',
        `ios  ${IOS_HASH}`,
        '  No stored build matches this fingerprint.',
      ].join('\n'),
    )
    expect(err).toEqual([
      `Calculating the android fingerprint of ${project}.`,
      `Calculating the ios fingerprint of ${project}.`,
    ])
  })

  it('prints the report as JSON, and exits with 1 when no build matches', async () => {
    const home = await tempDir()
    const project = await writeFingerprintProject(await tempDir(), {
      hashes: { android: ANDROID_HASH },
    })
    await writeStoredBuild(
      home,
      easBuild({ id: ID_A, fingerprint: { hash: 'other' } }),
    )
    const { io, out } = capture()

    expect(
      await run(
        ['match', '--platform', 'android', '--json'],
        testContext({ io, home, cwd: project }),
      ),
    ).toBe(EXIT_CODE.failure)

    expect(JSON.parse(out.join('\n'))).toEqual({
      project,
      fingerprintVersion: '0.20.13',
      platforms: [{ platform: 'android', hash: ANDROID_HASH, matches: [] }],
    })
    expect(await fingerprintCalls(project)).toHaveLength(1)
  })

  it('shows a local build with the same hash as a match', async () => {
    const home = await tempDir()
    const project = await writeFingerprintProject(await tempDir(), {
      hashes: { android: ANDROID_HASH },
    })
    await writeLocalBuild(
      home,
      ID_B,
      localBuild({ fingerprintHash: ANDROID_HASH }),
    )
    const { io, out } = capture()

    expect(
      await run(
        ['match', '--platform', 'android'],
        testContext({ io, home, cwd: project }),
      ),
    ).toBe(EXIT_CODE.ok)

    expect(out.join('\n')).toContain(
      '  bbbb2222  android   local debug  1.2.0    89abcde  2026-10-17  -',
    )
  })

  it('gives the hint when no platform matches', async () => {
    const home = await tempDir()
    const project = await writeFingerprintProject(await tempDir(), {
      hashes: { android: ANDROID_HASH, ios: IOS_HASH },
    })
    const { io, out } = capture()

    expect(await run(['match'], testContext({ io, home, cwd: project }))).toBe(
      EXIT_CODE.failure,
    )

    expect(out.join('\n')).toContain(
      'Run devhub sync to download the newest EAS builds. When EAS has no build with this fingerprint, make a new build.',
    )
  })

  it('refuses a platform that is not android or ios', async () => {
    const home = await tempDir()
    const { io, err } = capture()

    expect(
      await run(['match', '--platform', 'web'], testContext({ io, home })),
    ).toBe(EXIT_CODE.usage)

    expect(err.join('\n')).toContain(
      '"web" is not a platform. Give android or ios.',
    )
  })

  it('stops when the folder has no package.json', async () => {
    const home = await tempDir()
    const cwd = await tempDir()
    const { io, out, err } = capture()

    expect(await run(['match'], testContext({ io, home, cwd }))).toBe(
      EXIT_CODE.failure,
    )

    expect(out).toEqual([])
    expect(err.join('\n')).toContain('have no package.json')
  })
})

describe('devhub install', () => {
  const tempDir = useTempDir()
  const EMULATOR_LINE =
    'emulator-5554  device product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64'
  const PHONE_LINE = 'R58M12ABCDE    unauthorized usb:1-1'

  function adbList(...lines: string[]): string {
    return ['List of devices attached', ...lines, ''].join('\n')
  }

  async function store() {
    const home = await tempDir()
    const file = await writeStoredBuild(home, easBuild({ id: ID_A }))
    return { home, file }
  }

  it('installs the build on the one ready device', async () => {
    const { home, file } = await store()
    const { io, out, err } = capture()
    const tools = fakeDeviceTools({
      devices: adbList(EMULATOR_LINE, PHONE_LINE),
      avdNames: { 'emulator-5554': 'Pixel_Light_34' },
    })

    expect(
      await run(['install', 'aaaa'], testContext({ io, home, run: tools.run })),
    ).toBe(EXIT_CODE.ok)
    expect(out).toEqual([
      `Installed the build ${ID_A} on Pixel_Light_34 (emulator-5554).`,
    ])
    expect(err).toEqual([
      `Installing the build ${ID_A} on Pixel_Light_34 (emulator-5554).`,
    ])
    expect(tools.calls.at(-1)?.slice(1)).toEqual([
      '-s',
      'emulator-5554',
      'install',
      '-r',
      '-d',
      file,
    ])
  })

  it('prints the build and the device as JSON', async () => {
    const { home, file } = await store()
    const { io, out } = capture()
    const tools = fakeDeviceTools({ devices: adbList(EMULATOR_LINE) })

    await run(
      ['install', ID_A, '--json'],
      testContext({ io, home, run: tools.run }),
    )

    expect(JSON.parse(out.join('\n'))).toEqual({
      id: ID_A,
      path: file,
      device: expect.objectContaining({ id: 'emulator-5554', ready: true }),
    })
  })

  it('runs no device tool when the store has no such build', async () => {
    const { home } = await store()
    const { io, err } = capture()
    const tools = fakeDeviceTools()

    expect(
      await run(['install', 'ffff'], testContext({ io, home, run: tools.run })),
    ).toBe(EXIT_CODE.failure)
    expect(err.join('\n')).toContain(
      'The store has no build with an ID that starts with "ffff".',
    )
    expect(tools.calls).toEqual([])
  })

  // A fake system breaks the store path, so these tests use the real system.
  // CI runs them on macOS, Linux, and Windows, which covers each iOS reason.
  const onMacos = process.platform === 'darwin'
  const NOT_MACOS = 'iOS simulators run only on macOS'

  const refused: [string, EasBuild, string, string][] = [
    [
      'an .aab',
      easBuild({ id: ID_B }),
      'app.aab',
      'is an Android App Bundle (app.aab)',
    ],
    [
      'an iOS device build',
      easBuild({ id: ID_B, platform: 'IOS' }),
      'app.ipa',
      onMacos ? 'is an iOS device build (app.ipa)' : NOT_MACOS,
    ],
    [
      'a file that is not an .apk or a simulator archive',
      easBuild({ id: ID_B }),
      'app.zip',
      'is not an Android .apk or an iOS simulator build',
    ],
  ]
  if (!onMacos) {
    refused.push([
      'an iOS simulator build',
      easBuild({ id: ID_B, platform: 'IOS', isForIosSimulator: true }),
      'app.tar.gz',
      NOT_MACOS,
    ])
  }

  it.each(refused)(
    'runs no device tool for %s',
    async (_label, eas, file, reason) => {
      const home = await tempDir()
      await writeStoredBuild(home, eas, file)
      const { io, err } = capture()
      const tools = fakeDeviceTools()

      expect(
        await run(['install', ID_B], testContext({ io, home, run: tools.run })),
      ).toBe(EXIT_CODE.failure)
      expect(err).toHaveLength(1)
      expect(err[0]).toContain(reason)
      expect(tools.calls).toEqual([])
    },
  )

  function installCalls(tools: { calls: (readonly string[])[] }) {
    return tools.calls.filter((command) => command[3] === 'install')
  }

  function programs(tools: { calls: (readonly string[])[] }) {
    return tools.calls.map((command) => path.basename(command[0] ?? ''))
  }

  describe.runIf(onMacos)('an iOS simulator build on macOS', () => {
    const BOOTED = {
      devices: {
        'com.apple.CoreSimulator.SimRuntime.iOS-18-6': [
          { udid: 'AAAA-1111', name: 'iPhone 16', state: 'Booted' },
          { udid: 'BBBB-2222', name: 'iPhone 15', state: 'Shutdown' },
        ],
      },
    }

    async function iosStore() {
      const home = await tempDir()
      await writeStoredBuild(
        home,
        easBuild({ id: ID_B, platform: 'IOS', isForIosSimulator: true }),
        'app.tar.gz',
      )
      return home
    }

    it('installs on the one booted simulator, and does not run adb', async () => {
      const home = await iosStore()
      const { io, out, err } = capture()
      const tools = fakeDeviceTools({ simulators: BOOTED })

      expect(
        await run(
          ['install', 'bbbb'],
          testContext({ io, home, run: tools.run }),
        ),
      ).toBe(EXIT_CODE.ok)
      expect(out).toEqual([
        `Installed the build ${ID_B} on iPhone 16 (AAAA-1111).`,
      ])
      expect(err).toEqual([
        `Installing the build ${ID_B} on iPhone 16 (AAAA-1111).`,
      ])
      expect(programs(tools)).toEqual(['xcrun', 'tar', 'xcrun'])
      expect(tools.calls.at(-1)).toEqual([
        'xcrun',
        'simctl',
        'install',
        'AAAA-1111',
        path.join(home, 'extracted', ID_B, 'My App.app'),
      ])
    })

    it('says how to boot a simulator when none is booted', async () => {
      const home = await iosStore()
      const { io, err } = capture()
      const tools = fakeDeviceTools()

      expect(
        await run(['install', ID_B], testContext({ io, home, run: tools.run })),
      ).toBe(EXIT_CODE.failure)
      expect(err).toEqual([
        'No iOS simulator runs now. Boot a simulator, and then run the command again.',
      ])
      expect(programs(tools)).toEqual(['xcrun'])
    })

    it('stops when --device names an Android device', async () => {
      const home = await iosStore()
      const { io, err } = capture()
      const tools = fakeDeviceTools({
        simulators: BOOTED,
        devices: adbList(EMULATOR_LINE),
      })

      expect(
        await run(
          ['install', ID_B, '--device', 'emulator-5554'],
          testContext({ io, home, run: tools.run }),
        ),
      ).toBe(EXIT_CODE.failure)
      expect(err).toEqual([
        'The device emulator-5554 is an Android emulator or device, but the build is for an iOS simulator.',
      ])
      expect(programs(tools)).not.toContain('tar')
    })

    it('stops when --device names a simulator for an Android build', async () => {
      const { home } = await store()
      const { io, err } = capture()
      const tools = fakeDeviceTools({
        simulators: BOOTED,
        devices: adbList(EMULATOR_LINE),
      })

      expect(
        await run(
          ['install', ID_A, '--device', 'AAAA-1111'],
          testContext({ io, home, run: tools.run }),
        ),
      ).toBe(EXIT_CODE.failure)
      expect(err).toEqual([
        'The device AAAA-1111 is an iOS simulator, but the build is for an Android emulator or device.',
      ])
      expect(installCalls(tools)).toEqual([])
    })
  })

  it('stops with the reason of each device when no device is ready', async () => {
    const { home } = await store()
    const { io, out, err } = capture()
    const tools = fakeDeviceTools({ devices: adbList(PHONE_LINE) })

    expect(
      await run(['install', ID_A], testContext({ io, home, run: tools.run })),
    ).toBe(EXIT_CODE.failure)
    expect(out).toEqual([])
    expect(err).toEqual([
      [
        'No Android emulator or device is ready:',
        '  R58M12ABCDE  Unlock the device, and accept the USB debugging prompt on it.',
      ].join('\n'),
    ])
    expect(installCalls(tools)).toEqual([])
  })

  it('says how to start a device when no device runs', async () => {
    const { home } = await store()
    const { io, err } = capture()
    const tools = fakeDeviceTools()

    expect(
      await run(['install', ID_A], testContext({ io, home, run: tools.run })),
    ).toBe(EXIT_CODE.failure)
    expect(err).toEqual([
      'No Android emulator or device runs now. Start an emulator, or connect a device with USB debugging on. Then run the command again.',
    ])
  })

  it('asks for --device with a usage error when two devices are ready', async () => {
    const { home } = await store()
    const { io, out, err } = capture()
    const tools = fakeDeviceTools({
      devices: adbList(EMULATOR_LINE, 'emulator-5556  device'),
    })

    expect(
      await run(['install', ID_A], testContext({ io, home, run: tools.run })),
    ).toBe(EXIT_CODE.usage)
    expect(out).toEqual([])
    expect(err.join('\n')).toContain(
      '2 devices are ready. Select one with --device <id>:\n  emulator-5554',
    )
    expect(err.join('\n')).toContain('Run "devhub install --help"')
    expect(installCalls(tools)).toEqual([])
  })

  it('installs on the device that --device names', async () => {
    const { home, file } = await store()
    const { io, out } = capture()
    const tools = fakeDeviceTools({
      devices: adbList(EMULATOR_LINE, 'emulator-5556  device'),
    })

    expect(
      await run(
        ['install', ID_A, '--device', 'emulator-5556'],
        testContext({ io, home, run: tools.run }),
      ),
    ).toBe(EXIT_CODE.ok)
    expect(out).toEqual([
      `Installed the build ${ID_A} on emulator-5556 (emulator-5556).`,
    ])
    expect(installCalls(tools).map((command) => command.slice(1))).toEqual([
      ['-s', 'emulator-5556', 'install', '-r', '-d', file],
    ])
    expect(programs(tools)).not.toContain('xcrun')
  })

  it.each([
    [
      'no running device',
      'emulator-9999',
      'No running Android emulator or device has the ID "emulator-9999". Run devhub devices to see the devices.',
    ],
    [
      'a device that is not ready',
      'R58M12ABCDE',
      'The device R58M12ABCDE is not ready. Unlock the device, and accept the USB debugging prompt on it.',
    ],
  ])('stops when --device names %s', async (_label, wanted, message) => {
    const { home } = await store()
    const { io, err } = capture()
    const tools = fakeDeviceTools({
      devices: adbList(EMULATOR_LINE, PHONE_LINE),
    })

    expect(
      await run(
        ['install', ID_A, '--device', wanted],
        testContext({ io, home, run: tools.run }),
      ),
    ).toBe(EXIT_CODE.failure)
    expect(err).toEqual([message])
    expect(installCalls(tools)).toEqual([])
  })

  it('stops with the fix when adb is missing', async () => {
    const { home } = await store()
    const { io, err } = capture()
    const tools = fakeDeviceTools({ adbMissing: true })

    expect(
      await run(['install', ID_A], testContext({ io, home, run: tools.run })),
    ).toBe(EXIT_CODE.failure)
    expect(err.join('\n')).toContain('DevHub cannot find adb.')
  })

  it('reports a failed install with the cause and the fix', async () => {
    const { home } = await store()
    const { io, out, err } = capture()
    const tools = fakeDeviceTools({
      devices: adbList(EMULATOR_LINE),
      install: {
        code: 1,
        stdout: 'Performing Streamed Install\n',
        stderr: 'adb: failed to install: Failure [INSTALL_FAILED_OLDER_SDK]\n',
      },
    })

    expect(
      await run(['install', ID_A], testContext({ io, home, run: tools.run })),
    ).toBe(EXIT_CODE.failure)
    expect(out).toEqual([])
    expect(err.at(-1)).toBe(
      '"adb install" failed with INSTALL_FAILED_OLDER_SDK. The Android version of the device is older than the minimum Android version of the build. Install it on a device or an emulator with a newer Android version.',
    )
  })
})
