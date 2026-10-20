import { chmod, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import pkg from '../../package.json' with { type: 'json' }
import { formatReport } from '../cli/doctor'
import { EXIT_CODE, run } from '../cli/run'
import type { CommandResult, CommandRunner } from '../command/run-command'
import { parseAdbVersion } from '../devices/android'
import { parseXcodeVersion } from '../devices/ios'
import {
  NODE_MINIMUM,
  doctor,
  doctorPassed,
  isAtLeast,
  type DoctorCheckId,
  type DoctorDeps,
  type DoctorReport,
} from '../flow/doctor'
import {
  capture,
  easBuild,
  fakeEas,
  testContext,
  useTempDir,
  writeStoredBuild,
} from './helpers'

const ADB_OUTPUT = `Android Debug Bridge version 1.0.41
Version 36.0.0-13206524
Installed as /sdk/platform-tools/adb
Running on Darwin 24.6.0 (arm64)
`

const XCODE_OUTPUT = 'Xcode 26.0.1\nBuild version 17A400\n'

const CLT_ONLY: CommandResult = {
  code: 1,
  stdout: '',
  stderr:
    "xcode-select: error: tool 'xcodebuild' requires Xcode, but active developer directory '/Library/Developer/CommandLineTools' is a command line tools instance",
}

const notFound = (program: string) =>
  Object.assign(new Error(`spawn ${program} ENOENT`), { code: 'ENOENT' })

/**
 * A fake for each program that the checks run: eas-cli, adb, and
 * xcodebuild. `missing` is a program that does not start.
 */
function fakeTools(
  options: {
    eas?: 'signed-in' | 'signed-out' | 'missing'
    adb?: CommandResult | 'missing'
    xcode?: CommandResult | 'missing'
  } = {},
): CommandRunner {
  const eas = fakeEas(
    {},
    options.eas === 'signed-out'
      ? { whoami: { code: 1, stdout: 'Not logged in\n', stderr: '' } }
      : {},
  )
  return async (command, runOptions) => {
    const program = path.basename(command[0]).replace(/\.exe$/i, '')
    if (program === 'eas' || program === 'npx') {
      if (options.eas === 'missing') {
        throw notFound(command[0])
      }
      return eas.run(command, runOptions)
    }
    if (program === 'adb' && command[1] === 'version') {
      if (options.adb === 'missing') {
        throw notFound(command[0])
      }
      return options.adb ?? { code: 0, stdout: ADB_OUTPUT, stderr: '' }
    }
    if (program === 'xcodebuild' && command[1] === '-version') {
      if (options.xcode === 'missing') {
        throw notFound(command[0])
      }
      return options.xcode ?? { code: 0, stdout: XCODE_OUTPUT, stderr: '' }
    }
    throw notFound(command[0])
  }
}

function check(report: DoctorReport, id: DoctorCheckId) {
  return report.checks.find((item) => item.id === id)
}

describe('doctor', () => {
  const tempDir = useTempDir()

  async function deps(
    overrides: Partial<DoctorDeps> = {},
  ): Promise<DoctorDeps> {
    const dir = await tempDir()
    return {
      run: fakeTools(),
      env: { DEVHUB_HOME: path.join(dir, 'store') },
      platform: process.platform,
      homedir: dir,
      cwd: dir,
      nodeVersion: '24.11.0',
      ...overrides,
    }
  }

  it('runs the five checks in a fixed order, and passes with each tool', async () => {
    const report = await doctor(await deps())

    expect(report.checks.map((item) => item.id)).toEqual([
      'node',
      'store',
      'eas',
      'android',
      'ios',
    ])
    expect(check(report, 'node')).toEqual({
      id: 'node',
      label: 'Node',
      status: 'ok',
      detail: 'Node 24.11.0',
    })
    expect(check(report, 'eas')).toEqual({
      id: 'eas',
      label: 'EAS',
      status: 'ok',
      detail: 'Signed in as someone (eas on PATH)',
    })
    expect(check(report, 'android')).toEqual({
      id: 'android',
      label: 'Android',
      status: 'ok',
      detail: 'Platform-Tools 36.0.0, adb on PATH',
    })
    expect(check(report, 'ios')?.status).toBe(
      process.platform === 'darwin' ? 'ok' : 'skip',
    )
    expect(doctorPassed(report)).toBe(true)
  })

  it('fails the Node check below the minimum', async () => {
    const report = await doctor(await deps({ nodeVersion: '20.18.1' }))

    expect(check(report, 'node')).toMatchObject({
      status: 'fail',
      detail: 'Node 20.18.1',
      fix: `DevHub needs Node ${NODE_MINIMUM} or later. Install a newer Node, and then run devhub doctor again.`,
    })
    expect(doctorPassed(report)).toBe(false)
  })

  it('keeps NODE_MINIMUM the same as engines.node of the package', () => {
    const engine = pkg.engines.node.replace(/^>=/, '')

    expect(isAtLeast(NODE_MINIMUM, engine)).toBe(true)
    expect(isAtLeast(engine, NODE_MINIMUM)).toBe(true)
  })

  it.each([
    ['20.19.0', '20.19.0', true],
    ['20.19.1', '20.19.0', true],
    ['20.9.0', '20.19.0', false],
    ['22.0.0', '20.19.0', true],
    ['v24.11.0', '20.19.0', true],
    ['20.19.0-nightly2025', '20.19.0', true],
    ['19.99.99', '20.19.0', false],
  ])('isAtLeast(%s, %s) is %s', (version, minimum, expected) => {
    expect(isAtLeast(version, minimum)).toBe(expected)
  })

  it('passes the store check for a missing folder with a writable parent', async () => {
    const input = await deps()
    const report = await doctor(input)

    expect(check(report, 'store')).toEqual({
      id: 'store',
      label: 'Store',
      status: 'ok',
      detail: `${input.env.DEVHUB_HOME} (from DEVHUB_HOME). The first sync or local build makes the folder.`,
    })
  })

  it('counts the stored builds, and names DEVHUB_HOME', async () => {
    const input = await deps()
    const home = input.env.DEVHUB_HOME ?? ''
    await writeStoredBuild(home, easBuild())

    const report = await doctor(input)

    expect(check(report, 'store')).toMatchObject({
      status: 'ok',
      detail: `${home} (from DEVHUB_HOME), 1 build`,
    })
  })

  it('warns about a build record that DevHub cannot read', async () => {
    const input = await deps()
    const home = input.env.DEVHUB_HOME ?? ''
    const folder = path.join(home, 'builds', 'broken')
    await mkdir(folder, { recursive: true })
    await writeFile(path.join(folder, 'build.json'), '{ not json')

    const report = await doctor(input)

    expect(check(report, 'store')).toMatchObject({
      status: 'warn',
      detail: `${home} (from DEVHUB_HOME), 0 builds`,
      fix: 'DevHub cannot read the record of 1 stored build. Run devhub list to see the reason for each one.',
    })
    expect(doctorPassed(report)).toBe(true)
  })

  it('fails the store check when the store path is a file', async () => {
    const input = await deps()
    const home = input.env.DEVHUB_HOME ?? ''
    await writeFile(home, 'not a folder')

    const report = await doctor(input)

    expect(check(report, 'store')).toMatchObject({
      status: 'fail',
      fix: `${home} is a file, not a folder. Move the file, or set DEVHUB_HOME to a different folder.`,
    })
    expect(doctorPassed(report)).toBe(false)
  })

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'fails the store check when DevHub cannot write to the folder',
    async () => {
      const input = await deps()
      const home = input.env.DEVHUB_HOME ?? ''
      await mkdir(home)
      await chmod(home, 0o500)

      try {
        const report = await doctor(input)

        expect(check(report, 'store')).toMatchObject({
          status: 'fail',
          fix: expect.stringContaining(`DevHub cannot write to ${home}.`),
        })
      } finally {
        await chmod(home, 0o700)
      }
    },
  )

  it('warns with the login command when eas-cli has no login', async () => {
    const report = await doctor(
      await deps({ run: fakeTools({ eas: 'signed-out' }) }),
    )

    expect(check(report, 'eas')).toEqual({
      id: 'eas',
      label: 'EAS',
      status: 'warn',
      detail: 'Not signed in (eas on PATH)',
      fix: 'eas-cli has no login. Run "eas login" in a terminal, and then start the sync again.',
    })
    expect(doctorPassed(report)).toBe(true)
  })

  it('warns when neither eas nor npx starts', async () => {
    const report = await doctor(
      await deps({ run: fakeTools({ eas: 'missing' }) }),
    )

    expect(check(report, 'eas')).toMatchObject({
      status: 'warn',
      detail: 'eas-cli does not start',
      fix: expect.stringContaining('Put "eas" or "npx" on PATH.'),
    })
  })

  it('warns with the adb fix when adb does not start', async () => {
    const report = await doctor(
      await deps({ run: fakeTools({ adb: 'missing' }) }),
    )

    expect(check(report, 'android')).toMatchObject({
      status: 'warn',
      detail: 'adb not found',
      fix: expect.stringMatching(
        /^DevHub cannot find adb\..*Android installs need adb\.$/,
      ),
    })
  })

  it('names the adb of ANDROID_HOME, and gives the end of a failed run', async () => {
    const dir = await tempDir()
    const program = process.platform === 'win32' ? 'adb.exe' : 'adb'
    const adb = path.join(dir, 'platform-tools', program)
    await mkdir(path.dirname(adb), { recursive: true })
    await writeFile(adb, '')
    const input = await deps({
      run: fakeTools({ adb: { code: 1, stdout: '', stderr: 'adb: broken' } }),
    })

    const report = await doctor({
      ...input,
      env: { ...input.env, ANDROID_HOME: dir },
    })

    expect(check(report, 'android')).toEqual({
      id: 'android',
      label: 'Android',
      status: 'warn',
      detail: adb,
      fix: '"adb version" failed with exit code 1. Install the Android SDK Platform-Tools again with Android Studio. Android installs need adb.\nadb: broken',
    })
  })

  it('skips the iOS check on Windows and Linux, and runs no xcodebuild', async () => {
    const calls: string[] = []
    const tools = fakeTools()
    const run: CommandRunner = (command, options) => {
      calls.push(command[0])
      return tools(command, options)
    }

    for (const platform of ['linux', 'win32'] as const) {
      const report = await doctor(await deps({ run, platform }))

      expect(check(report, 'ios')).toEqual({
        id: 'ios',
        label: 'iOS',
        status: 'skip',
        detail: 'iOS simulators need macOS.',
      })
    }
    expect(calls).not.toContain('xcodebuild')
  })

  it('reads the Xcode version on macOS', async () => {
    const report = await doctor(await deps({ platform: 'darwin' }))

    expect(check(report, 'ios')).toEqual({
      id: 'ios',
      label: 'iOS',
      status: 'ok',
      detail: 'Xcode 26.0.1',
    })
  })

  it('warns when xcode-select points at the Command Line Tools', async () => {
    const report = await doctor(
      await deps({ platform: 'darwin', run: fakeTools({ xcode: CLT_ONLY }) }),
    )

    expect(check(report, 'ios')).toMatchObject({
      status: 'warn',
      detail: 'Xcode not selected',
      fix: expect.stringContaining(
        'sudo xcode-select --switch /Applications/Xcode.app',
      ),
    })
  })

  it('warns when xcodebuild does not start', async () => {
    const report = await doctor(
      await deps({ platform: 'darwin', run: fakeTools({ xcode: 'missing' }) }),
    )

    expect(check(report, 'ios')).toMatchObject({
      status: 'warn',
      detail: 'Xcode not found',
      fix: expect.stringMatching(
        /^DevHub cannot find xcodebuild\..*iOS simulator installs need Xcode\.$/,
      ),
    })
  })
})

describe('the version parsers', () => {
  it('reads the Platform-Tools version, and the adb version of an old adb', () => {
    expect(parseAdbVersion(ADB_OUTPUT)).toBe('36.0.0')
    expect(parseAdbVersion('Android Debug Bridge version 1.0.40\n')).toBe(
      '1.0.40',
    )
    expect(parseAdbVersion('')).toBeUndefined()
  })

  it('reads the Xcode version', () => {
    expect(parseXcodeVersion(XCODE_OUTPUT)).toBe('26.0.1')
    expect(parseXcodeVersion('')).toBeUndefined()
  })
})

describe('devhub doctor', () => {
  const tempDir = useTempDir()

  async function cli(
    argv: string[],
    tools: CommandRunner,
    nodeVersion = '24.11.0',
  ) {
    const home = path.join(await tempDir(), 'store')
    const output = capture()
    // The real platform: a fake one resolves the store path with the path
    // rules of another system, and breaks it on a Windows host.
    const code = await run(argv, {
      ...testContext({ io: output.io, home }),
      homedir: await tempDir(),
      run: tools,
      nodeVersion,
    })
    return { code, ...output, home }
  }

  it('prints one row for each check, and the fix below a warning', async () => {
    const { code, out, err, home } = await cli(
      ['doctor'],
      fakeTools({ eas: 'signed-out' }),
    )

    expect(code).toBe(EXIT_CODE.ok)
    expect(err).toEqual([])
    const text = out.join('\n')
    expect(text).toMatch(/^DevHub \S+\n\n/)
    expect(text).toContain('ok    Node     Node 24.11.0\n')
    expect(text).toContain(
      `ok    Store    ${home} (from DEVHUB_HOME). The first sync or local build makes the folder.\n`,
    )
    expect(text).toContain(
      'warn  EAS      Not signed in (eas on PATH)\n               eas-cli has no login. Run "eas login" in a terminal, and then start the sync again.\n',
    )
    expect(text).toContain(
      process.platform === 'darwin'
        ? 'ok    iOS      Xcode 26.0.1\n'
        : 'skip  iOS      iOS simulators need macOS.\n',
    )
    expect(text).toMatch(
      /\n1 warning\. The other features work\. Do the fix above for the features that you use\.$/,
    )
  })

  it('exits with 1 when a check fails', async () => {
    const { code, out } = await cli(['doctor'], fakeTools(), '18.20.0')

    expect(code).toBe(EXIT_CODE.failure)
    expect(out.join('\n')).toMatch(
      /\n1 check failed\. DevHub cannot work until you do the fix above\.$/,
    )
  })

  it('says so when no check has a problem', () => {
    const lines = formatReport({
      checks: [{ id: 'node', label: 'Node', status: 'ok', detail: 'Node 24' }],
    })

    expect(lines.at(-1)).toBe('No problems found.')
  })

  it('--json prints the report of the flow, with the same exit code', async () => {
    const { code, out, home } = await cli(
      ['doctor', '--json'],
      fakeTools({ adb: 'missing' }),
    )

    expect(code).toBe(EXIT_CODE.ok)
    const report = JSON.parse(out.join('\n')) as DoctorReport
    expect(report.checks.map((item) => [item.id, item.status])).toEqual([
      ['node', 'ok'],
      ['store', 'ok'],
      ['eas', 'ok'],
      ['android', 'warn'],
      ['ios', process.platform === 'darwin' ? 'ok' : 'skip'],
    ])
    expect(check(report, 'store')?.detail).toContain(home)
  })

  it('takes no arguments', async () => {
    const { code, err } = await cli(['doctor', 'now'], fakeTools())

    expect(code).toBe(EXIT_CODE.usage)
    expect(err.join('\n')).toContain('devhub doctor takes no arguments.')
  })
})
