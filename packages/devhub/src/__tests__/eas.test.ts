import { describe, expect, it } from 'vitest'
import type { CommandRunner } from '../command/run-command'
import {
  BUILD_LIST_PAGE_SIZE,
  EasCliError,
  checkEasLogin,
  easBuildListCommand,
  listFinishedBuilds,
  parseBuildList,
} from '../eas/cli'
import { easBuild, fakeEas, uuid } from './helpers'

describe('easBuildListCommand', () => {
  it('builds the public eas-cli command as an array', () => {
    expect(easBuildListCommand('dev client', 100)).toEqual([
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
})

describe('listFinishedBuilds', () => {
  it('reads pages until a page is not full', async () => {
    const builds = Array.from({ length: 120 }, (_, i) =>
      easBuild({ id: uuid(i) }),
    )
    const eas = fakeEas({ development: builds })

    const result = await listFinishedBuilds(eas.run, '/work/app', 'development')

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

    const result = await listFinishedBuilds(eas.run, '/work/app', 'development')

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

    const result = await listFinishedBuilds(run, '/work/app', 'development')

    expect(result).toHaveLength(BUILD_LIST_PAGE_SIZE)
    expect(calls).toBe(2)
  })

  it('runs eas in the project folder', async () => {
    const cwds: string[] = []
    const run: CommandRunner = async (_command, options) => {
      cwds.push(options.cwd)
      return { code: 0, stdout: '[]', stderr: '' }
    }

    await listFinishedBuilds(run, '/work/app', 'development')

    expect(cwds).toEqual(['/work/app'])
  })

  it('reports a failed eas command with the end of its stderr', async () => {
    const run: CommandRunner = async () => ({
      code: 1,
      stdout: '',
      stderr: 'Some log\nProject is not configured for EAS.\n',
    })

    await expect(
      listFinishedBuilds(run, '/work/app', 'development'),
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
  it('passes when eas whoami succeeds', async () => {
    await expect(
      checkEasLogin(fakeEas({}).run, '/work'),
    ).resolves.toBeUndefined()
  })

  it('gives the login command when eas has no login', async () => {
    const eas = fakeEas({}, { whoami: { code: 1, stderr: 'Not logged in\n' } })

    await expect(checkEasLogin(eas.run, '/work')).rejects.toThrow(
      'Run "eas login"',
    )
  })

  it('gives the install command when eas is not on PATH', async () => {
    const run: CommandRunner = async () => {
      throw Object.assign(new Error('spawn eas ENOENT'), { code: 'ENOENT' })
    }

    await expect(checkEasLogin(run, '/work')).rejects.toThrow(
      'npm install --global eas-cli',
    )
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
