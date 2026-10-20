import { describe, expect, it } from 'vitest'
import { EXIT_CODE, run } from '../cli/run'
import type { CommandRunner } from '../command/run-command'
import { canSync, whoami } from '../flow/whoami'
import { capture, fakeEas, testContext } from './helpers'

const NOT_FOUND: CommandRunner = async ([program]) => {
  throw Object.assign(new Error(`spawn ${program} ENOENT`), { code: 'ENOENT' })
}

describe('whoami', () => {
  it('reports a login with the user name and eas on PATH', async () => {
    const eas = fakeEas({})

    await expect(whoami({ run: eas.run, cwd: '/work' })).resolves.toEqual({
      state: 'signed-in',
      cli: 'eas',
      user: 'someone',
    })
    expect(eas.calls).toEqual([['eas', 'whoami']])
  })

  it('reports npx when eas is not on PATH', async () => {
    const eas = fakeEas({}, { easOnPath: false })

    await expect(whoami({ run: eas.run, cwd: '/work' })).resolves.toEqual({
      state: 'signed-in',
      cli: 'npx',
      user: 'someone',
    })
  })

  it('reports signed-out with the login command, from stdout or stderr', async () => {
    const onStdout = fakeEas(
      {},
      { whoami: { code: 1, stdout: 'Not logged in\n', stderr: '' } },
    )
    const onStderr = fakeEas(
      {},
      { easOnPath: false, whoami: { code: 1, stderr: 'Not logged in\n' } },
    )

    await expect(whoami({ run: onStdout.run, cwd: '/work' })).resolves.toEqual({
      state: 'signed-out',
      cli: 'eas',
      message:
        'eas-cli has no login. Run "eas login" in a terminal, and then start the sync again.',
    })
    await expect(
      whoami({ run: onStderr.run, cwd: '/work' }),
    ).resolves.toMatchObject({
      state: 'signed-out',
      cli: 'npx',
      message: expect.stringContaining('Run "npx --yes eas-cli login"'),
    })
  })

  it('reports no-cli when neither eas nor npx starts', async () => {
    await expect(whoami({ run: NOT_FOUND, cwd: '/work' })).resolves.toEqual({
      state: 'no-cli',
      cli: 'none',
      message: expect.stringContaining('Put "eas" or "npx" on PATH'),
    })
  })

  it('reports failed with the end of stderr for another failure', async () => {
    const eas = fakeEas(
      {},
      { whoami: { code: 1, stderr: 'request to https://api.expo.dev failed' } },
    )

    await expect(whoami({ run: eas.run, cwd: '/work' })).resolves.toEqual({
      state: 'failed',
      cli: 'eas',
      message:
        '"eas whoami" failed with exit code 1.\nrequest to https://api.expo.dev failed',
    })
  })

  it('rethrows an error that is not about eas-cli', async () => {
    const run: CommandRunner = async () => {
      throw new Error('boom')
    }

    await expect(whoami({ run, cwd: '/work' })).rejects.toThrow('boom')
  })

  it('canSync is true only with a login', () => {
    expect(canSync({ state: 'signed-in', cli: 'eas' })).toBe(true)
    expect(canSync({ state: 'signed-out', cli: 'eas' })).toBe(false)
    expect(canSync({ state: 'no-cli', cli: 'none' })).toBe(false)
    expect(canSync({ state: 'failed', cli: 'npx' })).toBe(false)
  })
})

describe('devhub whoami', () => {
  it('prints the user and exits with 0', async () => {
    const { io, out, err } = capture()
    const eas = fakeEas({})

    expect(
      await run(['whoami'], testContext({ io, home: '/unused', run: eas.run })),
    ).toBe(EXIT_CODE.ok)
    expect(out).toEqual(['Signed in to EAS as someone (eas on PATH).'])
    expect(err).toEqual([])
  })

  it('prints the fix on stderr and exits with 1 without a login', async () => {
    const { io, out, err } = capture()
    const eas = fakeEas(
      {},
      {
        easOnPath: false,
        whoami: { code: 1, stdout: 'Not logged in\n', stderr: '' },
      },
    )

    expect(
      await run(['whoami'], testContext({ io, home: '/unused', run: eas.run })),
    ).toBe(EXIT_CODE.failure)
    expect(out).toEqual([])
    expect(err).toEqual([
      'eas-cli has no login. Run "npx --yes eas-cli login" in a terminal, and then start the sync again.',
    ])
  })

  it('prints the JSON and exits with 1 without a login', async () => {
    const { io, out } = capture()
    const eas = fakeEas(
      {},
      { whoami: { code: 1, stdout: 'Not logged in\n', stderr: '' } },
    )

    expect(
      await run(
        ['whoami', '--json'],
        testContext({ io, home: '/unused', run: eas.run }),
      ),
    ).toBe(EXIT_CODE.failure)
    expect(JSON.parse(out.join('\n'))).toMatchObject({
      state: 'signed-out',
      cli: 'eas',
    })
  })

  it('refuses an argument', async () => {
    const { io, err } = capture()

    expect(
      await run(['whoami', 'me'], testContext({ io, home: '/unused' })),
    ).toBe(EXIT_CODE.usage)
    expect(err[0]).toContain('devhub whoami takes no arguments.')
  })
})
