// The same states and words as `devhub doctor`, so the page and the terminal
// agree.
import type { DoctorReport, DoctorStatus } from '../api/types'

export const SETUP_INTRO =
  'Check Node, the store, eas-cli, adb, and Xcode on this machine, and get the fix for each problem. The EAS check can use the network.'

const STATUS_LABEL: Record<DoctorStatus, string> = {
  ok: 'OK',
  warn: 'Warning',
  fail: 'Failed',
  skip: 'Skipped',
}

export type DoctorRow = {
  id: string
  title: string
  /** The state, for example "Warning". */
  status: string
  /** The chip text, for example "EAS: Warning". */
  chip: string
  /** `true` for a warning and a failure. */
  problem: boolean
  /** What DevHub found, for example "Node 24.11.0". */
  detail: string
  /** With a warning and a failure: what is wrong, and the fix. */
  fix?: string
}

export type DoctorView = {
  /** One line above the checks. */
  summary: string
  tone: 'ok' | 'warn' | 'fail'
  rows: DoctorRow[]
}

export function doctorView(report: DoctorReport): DoctorView {
  const failures = count(report, 'fail')
  const warnings = count(report, 'warn')
  const rows = report.checks.map((check): DoctorRow => {
    const status = STATUS_LABEL[check.status]
    const row: DoctorRow = {
      id: check.id,
      title: check.label,
      status,
      chip: `${check.label}: ${status}`,
      problem: check.status === 'warn' || check.status === 'fail',
      detail: check.detail,
    }
    return check.fix === undefined ? row : { ...row, fix: check.fix }
  })
  if (failures > 0) {
    return {
      summary: `${plural(failures, 'check failed', 'checks failed')}. DevHub cannot work until you do the fix.`,
      tone: 'fail',
      rows,
    }
  }
  if (warnings > 0) {
    return {
      summary: `${plural(warnings, 'warning', 'warnings')}. The other features work. Do the fix for the features that you use.`,
      tone: 'warn',
      rows,
    }
  }
  return { summary: 'No problems found.', tone: 'ok', rows }
}

function count(report: DoctorReport, status: DoctorStatus): number {
  return report.checks.filter((check) => check.status === status).length
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}
