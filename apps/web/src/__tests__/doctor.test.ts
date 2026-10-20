import { describe, expect, it } from 'vitest'
import type { DoctorCheck } from '../api/types'
import { doctorView } from '../logic/doctor'

const NODE: DoctorCheck = {
  id: 'node',
  label: 'Node',
  status: 'ok',
  detail: 'Node 24.11.0',
}

const EAS_WARN: DoctorCheck = {
  id: 'eas',
  label: 'EAS',
  status: 'warn',
  detail: 'Not signed in (eas on PATH)',
  fix: 'eas-cli has no login. Run "eas login" in a terminal.',
}

describe('doctorView', () => {
  it('says so when no check has a problem, and shows a skip as no problem', () => {
    const view = doctorView({
      checks: [
        NODE,
        {
          id: 'ios',
          label: 'iOS',
          status: 'skip',
          detail: 'iOS simulators need macOS.',
        },
      ],
    })

    expect(view.summary).toBe('No problems found.')
    expect(view.tone).toBe('ok')
    expect(view.rows).toEqual([
      {
        id: 'node',
        title: 'Node',
        status: 'OK',
        problem: false,
        text: 'Node 24.11.0',
      },
      {
        id: 'ios',
        title: 'iOS',
        status: 'Skipped',
        problem: false,
        text: 'iOS simulators need macOS.',
      },
    ])
  })

  it('counts the warnings, and puts the fix below the detail', () => {
    const view = doctorView({ checks: [NODE, EAS_WARN] })

    expect(view.tone).toBe('warn')
    expect(view.summary).toBe(
      '1 warning. The other features work. Do the fix for the features that you use.',
    )
    expect(view.rows[1]).toEqual({
      id: 'eas',
      title: 'EAS',
      status: 'Warning',
      problem: true,
      text: 'Not signed in (eas on PATH)\neas-cli has no login. Run "eas login" in a terminal.',
    })
  })

  it('names the failures before the warnings', () => {
    const view = doctorView({
      checks: [
        { ...NODE, status: 'fail', fix: 'DevHub needs Node 20.19.0.' },
        EAS_WARN,
        { ...EAS_WARN, id: 'android', label: 'Android' },
      ],
    })

    expect(view.tone).toBe('fail')
    expect(view.summary).toBe(
      '1 check failed. DevHub cannot work until you do the fix.',
    )
    expect(view.rows[0]?.status).toBe('Failed')
  })
})
