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
  /** The chip text, for example "Warning". */
  status: string
  /** `true` for a warning and a failure. */
  problem: boolean
  /** What DevHub found, and the fix on the next line. */
  text: string
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
  const rows = report.checks.map((check) => ({
    id: check.id,
    title: check.label,
    status: STATUS_LABEL[check.status],
    problem: check.status === 'warn' || check.status === 'fail',
    text:
      check.fix === undefined ? check.detail : `${check.detail}\n${check.fix}`,
  }))
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
