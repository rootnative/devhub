import { describe, expect, it } from 'vitest'
import type { BuildOutcome, ProjectSyncResult } from '../api/types'
import { syncView } from '../logic/sync'

function outcome(
  id: string,
  status: BuildOutcome['status'],
  extra: Partial<BuildOutcome> = {},
): BuildOutcome {
  return { id, status, profile: 'development', platform: 'ANDROID', ...extra }
}

function project(extra: Partial<ProjectSyncResult>): ProjectSyncResult {
  return {
    project: '/work/app',
    status: 'ok',
    profiles: [{ name: 'development', platforms: ['ANDROID'] }],
    builds: [],
    warnings: [],
    ...extra,
  }
}

describe('syncView', () => {
  it('lists the downloads, and counts the stored and expired builds', () => {
    const view = syncView({
      dryRun: false,
      projects: [
        project({
          builds: [
            outcome('aaaa1111-0000', 'downloaded', { size: 214_795_512 }),
            outcome('bbbb2222-0000', 'stored'),
            outcome('cccc3333-0000', 'expired'),
          ],
        }),
      ],
    })

    expect(view).toEqual({
      failed: false,
      projects: [
        {
          name: 'app',
          path: '/work/app',
          failed: false,
          lines: [
            'Downloaded aaaa1111 · Android · development · 214.8 MB',
            '1 downloaded (214.8 MB), 1 already stored, 1 build expired before sync.',
          ],
        },
      ],
    })
  })

  it('marks a failed download and a failed project', () => {
    const view = syncView({
      dryRun: false,
      projects: [
        project({
          project: 'C:\\work\\shop\\',
          builds: [
            outcome('aaaa1111-0000', 'failed', {
              platform: 'IOS',
              isForIosSimulator: true,
              error: 'The download failed with HTTP 403 Forbidden.',
            }),
          ],
          warnings: [
            'The profile "preview" extends a profile that does not exist.',
          ],
        }),
        project({
          project: '/work/broken',
          status: 'failed',
          error: 'eas.json is not valid JSON.',
        }),
        project({ project: '/work/gone', status: 'missing' }),
      ],
    })

    expect(view.failed).toBe(true)
    expect(view.projects.map((p) => [p.name, p.failed])).toEqual([
      ['shop', true],
      ['broken', true],
      ['gone', false],
    ])
    expect(view.projects[0]?.lines).toEqual([
      'Failed aaaa1111 · iOS simulator · development. The download failed with HTTP 403 Forbidden.',
      '1 failed.',
      'Warning: The profile "preview" extends a profile that does not exist.',
    ])
    expect(view.projects[1]?.lines).toEqual([
      'Failed. eas.json is not valid JSON.',
    ])
    expect(view.projects[2]?.lines).toEqual([
      'Skipped. The folder does not exist.',
    ])
  })

  it('says when EAS has no build of the profiles', () => {
    const view = syncView({ dryRun: false, projects: [project({})] })

    expect(view.projects[0]?.lines).toEqual([
      'EAS has no finished build of these profiles.',
    ])
  })

  it('has no project when DevHub knows none', () => {
    expect(syncView({ dryRun: false, projects: [] })).toEqual({
      failed: false,
      projects: [],
    })
  })
})
