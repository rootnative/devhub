import { describe, expect, it } from 'vitest'
import type { BuildOutcome, ProjectSyncResult } from '../api/types'
import { NO_PROJECT, syncMessage, syncView } from '../logic/sync'

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

describe('syncMessage', () => {
  it('names the new build and its project, with the IDs for Show', () => {
    const message = syncMessage({
      kind: 'ok',
      value: {
        dryRun: false,
        projects: [
          project({
            project: '/work/shop-app',
            builds: [outcome('new-1', 'downloaded'), outcome('old', 'stored')],
          }),
          project({ project: '/work/notes', builds: [outcome('n', 'stored')] }),
        ],
      },
    })
    expect(message).toEqual({
      message: 'Sync done. 1 new build in shop-app.',
      added: ['new-1'],
    })
  })

  it('counts the projects when more than one got a build', () => {
    const message = syncMessage({
      kind: 'ok',
      value: {
        dryRun: false,
        projects: [
          project({ project: '/work/a', builds: [outcome('1', 'downloaded')] }),
          project({
            project: '/work/b',
            builds: [outcome('2', 'downloaded'), outcome('3', 'downloaded')],
          }),
        ],
      },
    })
    expect(message.message).toBe('Sync done. 3 new builds in 2 projects.')
    expect(message.added).toEqual(['1', '2', '3'])
  })

  it('says when no build is new', () => {
    expect(
      syncMessage({
        kind: 'ok',
        value: {
          dryRun: false,
          projects: [project({ builds: [outcome('a', 'stored')] })],
        },
      }),
    ).toEqual({ message: 'Sync done. No new builds.', added: [] })
  })

  it('gives the details of a failed project or build', () => {
    const message = syncMessage({
      kind: 'ok',
      value: {
        dryRun: false,
        projects: [project({ status: 'failed', error: 'eas-cli failed.' })],
      },
    })
    expect(message.message).toBe(
      'Sync done. No new builds. Some projects or builds failed.',
    )
    expect(message.details?.kind).toBe('report')
  })

  it('gives the error of a sync that did not run as the details', () => {
    expect(
      syncMessage({ kind: 'error', message: 'Another sync runs now.' }),
    ).toEqual({
      message: 'Sync failed.',
      added: [],
      details: { kind: 'error', message: 'Another sync runs now.' },
    })
  })

  it('says when DevHub knows no project folder', () => {
    expect(
      syncMessage({ kind: 'ok', value: { dryRun: false, projects: [] } }),
    ).toEqual({ message: NO_PROJECT, added: [] })
  })
})
