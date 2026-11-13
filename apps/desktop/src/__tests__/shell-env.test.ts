import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  childEnv,
  loginShellEnv,
  needsShellEnv,
  readShellEnv,
  shellEnvCommand,
} from '../shell-env'

const MARK = 'f00dfeed'

describe('needsShellEnv', () => {
  it('reads the shell for an app from Finder or a Linux launcher', () => {
    expect(needsShellEnv('darwin', { PATH: '/usr/bin:/bin' })).toBe(true)
    expect(needsShellEnv('linux', { PATH: '/usr/bin:/bin' })).toBe(true)
  })

  it('keeps the environment of a start from a terminal', () => {
    expect(needsShellEnv('darwin', { TERM: 'xterm-256color' })).toBe(false)
  })

  it('keeps the environment on Windows', () => {
    expect(needsShellEnv('win32', {})).toBe(false)
  })
})

describe('shellEnvCommand', () => {
  it('starts an interactive login shell', () => {
    const [program, args] = shellEnvCommand('/bin/zsh', MARK)
    expect(program).toBe('/bin/zsh')
    expect(args.slice(0, 3)).toEqual(['-i', '-l', '-c'])
    expect(args[3]).toBe(
      `printf '%s' ${MARK}; /usr/bin/env -0; printf '%s' ${MARK}`,
    )
  })

  it('gives csh and tcsh no -l', () => {
    expect(shellEnvCommand('/bin/tcsh', MARK)[1].slice(0, 2)).toEqual([
      '-i',
      '-c',
    ])
    expect(shellEnvCommand('/bin/csh', MARK)[1].slice(0, 2)).toEqual([
      '-i',
      '-c',
    ])
  })

  it('gives fish the same flags as zsh', () => {
    expect(shellEnvCommand('/opt/homebrew/bin/fish', MARK)[1]).toHaveLength(4)
  })
})

describe('readShellEnv', () => {
  const output = (entries: string[]) =>
    `Welcome back\n${MARK}${entries.join('\0')}\0${MARK}bye\n`

  it('reads the entries between the marks', () => {
    expect(
      readShellEnv(
        output(['PATH=/usr/bin:/bin', 'ANDROID_HOME=/sdk', 'EMPTY=']),
        MARK,
      ),
    ).toEqual({ PATH: '/usr/bin:/bin', ANDROID_HOME: '/sdk', EMPTY: '' })
  })

  it('keeps a value with an equals sign or a new line', () => {
    expect(
      readShellEnv(output(['PATH=/bin', 'A=b=c', 'B=one\ntwo']), MARK),
    ).toMatchObject({ A: 'b=c', B: 'one\ntwo' })
  })

  it('waits for the second mark', () => {
    expect(readShellEnv(`${MARK}PATH=/bin\0`, MARK)).toBeUndefined()
    expect(readShellEnv('PATH=/bin\0', MARK)).toBeUndefined()
  })

  it('refuses an environment with no PATH', () => {
    expect(readShellEnv(output(['HOME=/home/dev']), MARK)).toBeUndefined()
  })
})

describe.skipIf(process.platform === 'win32')('loginShellEnv', () => {
  // A HOME with no profile, so the test never loads the profile of the
  // developer who runs it.
  const home = mkdtempSync(path.join(tmpdir(), 'devhub-shell-env-'))
  afterAll(() => rmSync(home, { recursive: true, force: true }))
  const env = { PATH: '/usr/bin:/bin', HOME: home }

  it('returns the environment of the shell', async () => {
    const result = await loginShellEnv(
      { ...env, DEVHUB_TEST_VALUE: 'one\ntwo=three' },
      '/bin/sh',
    )
    expect(result.DEVHUB_TEST_VALUE).toBe('one\ntwo=three')
    expect(result.HOME).toBe(home)
  })

  it('fails when the shell stops with no environment', async () => {
    await expect(loginShellEnv(env, '/usr/bin/false')).rejects.toThrow(
      'gave no environment',
    )
  })

  it('stops a shell that does not answer', async () => {
    const shell = path.join(home, 'slow-shell')
    writeFileSync(shell, '#!/bin/sh\nexec sleep 30\n')
    chmodSync(shell, 0o755)
    await expect(loginShellEnv(env, shell, 200)).rejects.toThrow(
      'it gave no environment in 200 ms',
    )
  })

  it('gives the child the app environment when the shell fails', async () => {
    const lines: string[] = []
    const appEnv = { ...env, SHELL: '/usr/bin/false' }
    expect(await childEnv('darwin', appEnv, (line) => lines.push(line))).toBe(
      appEnv,
    )
    expect(lines).toHaveLength(1)
    expect(lines[0]).toContain('/usr/bin/false')
  })
})
