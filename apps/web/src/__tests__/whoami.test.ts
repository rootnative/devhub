import { describe, expect, it } from 'vitest'
import { CHECKING, easStatus } from '../logic/whoami'

describe('easStatus', () => {
  it('is pending while the check runs, and Sync is off', () => {
    expect(easStatus({ kind: 'loading' })).toEqual({
      label: 'EAS: checking the login',
      tone: 'pending',
      canSync: false,
      reason: CHECKING,
    })
  })

  it('names the user with a login, and Sync is on with no reason', () => {
    expect(
      easStatus({
        kind: 'ok',
        value: { state: 'signed-in', cli: 'npx', user: 'ana' },
      }),
    ).toEqual({
      label: 'EAS: signed in as ana',
      tone: 'ok',
      icon: 'eas-signed-in',
      canSync: true,
    })
    expect(
      easStatus({ kind: 'ok', value: { state: 'signed-in', cli: 'eas' } }),
    ).toMatchObject({ label: 'EAS: signed in', canSync: true })
  })

  it('gives the CLI message as the reason for each other state', () => {
    const message = 'eas-cli has no login. Run "eas login" in a terminal.'
    expect(
      easStatus({
        kind: 'ok',
        value: { state: 'signed-out', cli: 'eas', message },
      }),
    ).toEqual({
      label: 'EAS: not signed in',
      tone: 'warn',
      icon: 'status-warn',
      canSync: false,
      reason: message,
    })
    expect(
      easStatus({
        kind: 'ok',
        value: { state: 'no-cli', cli: 'none', message: 'Put "eas" on PATH.' },
      }),
    ).toMatchObject({
      label: 'EAS: eas-cli is not installed',
      canSync: false,
      reason: 'Put "eas" on PATH.',
    })
    expect(
      easStatus({
        kind: 'ok',
        value: { state: 'failed', cli: 'npx', message: 'no network' },
      }),
    ).toMatchObject({
      label: 'EAS: the login check failed',
      canSync: false,
      reason: 'no network',
    })
  })

  it('shows an API error as a failed check', () => {
    expect(
      easStatus({ kind: 'error', message: 'The token is wrong.' }),
    ).toEqual({
      label: 'EAS: the login check failed',
      tone: 'warn',
      icon: 'status-warn',
      canSync: false,
      reason: 'The token is wrong.',
    })
  })
})
