import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import pkg from '../../package.json' with { type: 'json' }
import { EXIT_CODE, run } from '../cli/run'
import { buildFolder } from '../store/builds'
import {
  capture,
  easBuild,
  fakeDeviceTools,
  fakeDownload,
  fakeEas,
  testContext,
  useTempDir,
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

  it.each([['sync'], ['list'], ['where'], ['devices'], ['install']])(
    'devhub %s --help prints the help of the command',
    async (command) => {
      const { io, out } = capture()

      expect(await run([command, '--help'], { io })).toBe(EXIT_CODE.ok)
      expect(out.join('\n')).toContain(`Usage: devhub ${command}`)
    },
  )

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

  it('runs no device tool for a build that is not an Android .apk', async () => {
    const home = await tempDir()
    await writeStoredBuild(
      home,
      easBuild({ id: ID_B, platform: 'IOS', isForIosSimulator: true }),
      'app.tar.gz',
    )
    const { io, err } = capture()
    const tools = fakeDeviceTools()

    expect(
      await run(['install', ID_B], testContext({ io, home, run: tools.run })),
    ).toBe(EXIT_CODE.failure)
    expect(err).toEqual([
      `DevHub can install only an Android .apk build now. The build ${ID_B} is the file app.tar.gz.`,
    ])
    expect(tools.calls).toEqual([])
  })

  it.each([
    ['no device is ready', adbList(PHONE_LINE), 0],
    [
      'two devices are ready',
      adbList(EMULATOR_LINE, 'emulator-5556  device'),
      2,
    ],
  ])('stops when %s', async (_label, devices, count) => {
    const { home } = await store()
    const { io, out, err } = capture()
    const tools = fakeDeviceTools({ devices })

    expect(
      await run(['install', ID_A], testContext({ io, home, run: tools.run })),
    ).toBe(EXIT_CODE.failure)
    expect(out).toEqual([])
    expect(err).toEqual([
      `devhub install needs exactly one ready Android emulator or device, and ${count} are ready. Run devhub devices to see the devices.`,
    ])
    expect(tools.calls.map((command) => command[3])).not.toContain('install')
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

  it('reports a failed install with the end of the adb output', async () => {
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
    expect(err.at(-1)).toMatch(
      /^"adb install" failed with exit code 1\.\n.*\n.*INSTALL_FAILED_OLDER_SDK/,
    )
  })
})
