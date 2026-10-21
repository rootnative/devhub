import type { WhoamiReport } from '../api/types'
import type { ApiState } from '../api/useApi'

export type EasStatus = {
  /** The text of the EAS chip, for example "EAS: signed in as ana". */
  label: string
  tone: 'ok' | 'warn' | 'pending'
  /** `true` only with a login. The Sync button is off otherwise. */
  canSync: boolean
  /** Why a sync cannot run, as the tooltip of the Sync button. */
  reason?: string
}

export const CHECKING = 'DevHub checks the EAS login.'

/** The EAS login state of the page, from `GET /api/whoami`. */
export function easStatus(state: ApiState<WhoamiReport>): EasStatus {
  if (state.kind === 'loading') {
    return {
      label: 'EAS: checking the login',
      tone: 'pending',
      canSync: false,
      reason: CHECKING,
    }
  }
  if (state.kind === 'error') {
    return {
      label: 'EAS: the login check failed',
      tone: 'warn',
      canSync: false,
      reason: state.message,
    }
  }
  const report = state.value
  switch (report.state) {
    case 'signed-in':
      return {
        label:
          report.user === undefined
            ? 'EAS: signed in'
            : `EAS: signed in as ${report.user}`,
        tone: 'ok',
        canSync: true,
      }
    case 'signed-out':
      return {
        label: 'EAS: not signed in',
        tone: 'warn',
        canSync: false,
        reason: report.message ?? 'Run eas login in a terminal.',
      }
    case 'no-cli':
      return {
        label: 'EAS: eas-cli is not installed',
        tone: 'warn',
        canSync: false,
        reason: report.message ?? 'Put eas or npx on PATH.',
      }
    case 'failed':
      return {
        label: 'EAS: the login check failed',
        tone: 'warn',
        canSync: false,
        reason: report.message ?? 'eas whoami failed.',
      }
  }
}
