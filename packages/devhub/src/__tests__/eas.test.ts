import { describe, expect, it } from 'vitest'
import type { CommandRunner } from '../command/run-command'
import {
  BUILD_LIST_PAGE_SIZE,
  EAS_ON_PATH,
  EAS_WITH_NPX,
  EasCliError,
  checkEasLogin,
  easBuildListCommand,
  listFinishedBuilds,
  parseBuildList,
} from '../eas/cli'
import { easBuild, fakeEas, uuid } from './helpers'

describe('easBuildListCommand', () => {
  it('builds the public eas-cli command as an array', () => {
    expect(easBuildListCommand('dev client', 100, EAS_ON_PATH)).toEqual([
      'eas',
      'build:list',
      '--json',
      '--non-interactive',
      '--status',
      'finished',
      '--build-profile',
      'dev client',
      '--limit',
      '50',
      '--offset',
      '100',
    ])
  })

  it('puts the npx prefix before the subcommand', () => {
    expect(easBuildListCommand('development', 0, EAS_WITH_NPX)).toEqual([
      'npx',
      '--yes',
      'eas-cli',
      'build:list',
      '--json',
      '--non-interactive',
      '--status',
      'finished',
      '--build-profile',
      'development',
      '--limit',
      '50',
      '--offset',
      '0',
    ])
  })
})

describe('listFinishedBuilds', () => {
  it('reads pages until a page is not full', async () => {
    const builds = Array.from({ length: 120 }, (_, i) =>
      easBuild({ id: uuid(i) }),
    )
    const eas = fakeEas({ development: builds })

    const result = await listFinishedBuilds(
      eas.run,
      '/work/app',
      'development',
      EAS_ON_PATH,
    )

    expect(result.map((build) => build.id)).toEqual(builds.map((b) => b.id))
    expect(eas.calls.map((command) => command.at(-1))).toEqual([
      '0',
      '50',
      '100',
    ])
  })

  it('reads one more empty page when the last page is full', async () => {
    const builds = Array.from({ length: BUILD_LIST_PAGE_SIZE }, (_, i) =>
      easBuild({ id: uuid(i) }),
    )
    const eas = fakeEas({ development: builds })

    const result = await listFinishedBuilds(
      eas.run,
      '/work/app',
      'development',
      EAS_ON_PATH,
    )

    expect(result).toHaveLength(BUILD_LIST_PAGE_SIZE)
    expect(eas.calls).toHaveLength(2)
  })

  it('stops when a full page has no new build', async () => {
    const page = Array.from({ length: BUILD_LIST_PAGE_SIZE }, (_, i) =>
      easBuild({ id: uuid(i) }),
    )
    let calls = 0
    const run: CommandRunner = async () => {
      calls++
      return { code: 0, stdout: JSON.stringify(page), stderr: '' }
    }

    const result = await listFinishedBuilds(
      run,
      '/work/app',
      'development',
      EAS_ON_PATH,
    )

    expect(result).toHaveLength(BUILD_LIST_PAGE_SIZE)
    expect(calls).toBe(2)
  })

  it('runs eas in the project folder', async () => {
    const cwds: string[] = []
    const run: CommandRunner = async (_command, options) => {
      cwds.push(options.cwd)
      return { code: 0, stdout: '[]', stderr: '' }
    }

    await listFinishedBuilds(run, '/work/app', 'development', EAS_ON_PATH)

    expect(cwds).toEqual(['/work/app'])
  })

  it('reports a failed eas command with the end of its stderr', async () => {
    const run: CommandRunner = async () => ({
      code: 1,
      stdout: '',
      stderr: 'Some log\nProject is not configured for EAS.\n',
    })

    await expect(
      listFinishedBuilds(run, '/work/app', 'development', EAS_ON_PATH),
    ).rejects.toThrow(
      /"eas build:list" failed for the build profile "development" with exit code 1\.\nSome log\nProject is not configured for EAS\.$/,
    )
  })
})

describe('parseBuildList', () => {
  it('reads the JSON array that eas-cli prints', () => {
    const build = easBuild({ futureField: { nested: true } })

    expect(parseBuildList(JSON.stringify([build]))).toEqual([build])
  })

  it.each([
    ['text', 'Builds for my-app:'],
    ['an object', '{}'],
    ['a build with no ID', '[{"platform": "ANDROID"}]'],
    [
      'a field of the wrong type',
      '[{"id": "x", "platform": "IOS", "artifacts": "x"}]',
    ],
  ])('refuses %s', (_name, stdout) => {
    expect(() => parseBuildList(stdout)).toThrow(EasCliError)
  })
})

describe('checkEasLogin', () => {
  it('uses eas on PATH when eas whoami succeeds', async () => {
    const eas = fakeEas({})

    await expect(checkEasLogin(eas.run, '/work')).resolves.toEqual(EAS_ON_PATH)
    expect(eas.calls).toEqual([['eas', 'whoami']])
  })

  it('uses npx when eas is not on PATH', async () => {
    const eas = fakeEas({}, { easOnPath: false })

    await expect(checkEasLogin(eas.run, '/work')).resolves.toEqual(EAS_WITH_NPX)
    expect(eas.calls).toEqual([
      ['eas', 'whoami'],
      ['npx', '--yes', 'eas-cli', 'whoami'],
    ])
  })

  it('gives the npx login command when eas-cli through npx has no login', async () => {
    const eas = fakeEas(
      {},
      { easOnPath: false, whoami: { code: 1, stderr: 'Not logged in\n' } },
    )

    await expect(checkEasLogin(eas.run, '/work')).rejects.toThrow(
      'Run "npx --yes eas-cli login"',
    )
  })

  it('gives the login command when eas has no login', async () => {
    const eas = fakeEas({}, { whoami: { code: 1, stderr: 'Not logged in\n' } })

    await expect(checkEasLogin(eas.run, '/work')).rejects.toThrow(
      'Run "eas login"',
    )
  })

  it('tells the user to fix PATH when neither eas nor npx starts', async () => {
    const run: CommandRunner = async ([program]) => {
      throw Object.assign(new Error(`spawn ${program} ENOENT`), {
        code: 'ENOENT',
      })
    }

    await expect(checkEasLogin(run, '/work')).rejects.toThrow(
      /cannot start "npx"\. Put "eas" or "npx" on PATH/,
    )
  })

  it('does not use npx when eas starts and fails', async () => {
    const eas = fakeEas(
      {},
      { whoami: { code: 1, stderr: 'request to https://api.expo.dev failed' } },
    )

    await expect(checkEasLogin(eas.run, '/work')).rejects.toThrow(EasCliError)
    expect(eas.calls).toEqual([['eas', 'whoami']])
  })

  it('reports a different failure with the end of its stderr', async () => {
    const eas = fakeEas(
      {},
      { whoami: { code: 1, stderr: 'request to https://api.expo.dev failed' } },
    )

    await expect(checkEasLogin(eas.run, '/work')).rejects.toThrow(
      /"eas whoami" failed with exit code 1\.\nrequest to/,
    )
  })
})
