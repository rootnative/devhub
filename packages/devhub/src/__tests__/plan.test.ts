import { describe, expect, it } from 'vitest'
import type { SyncProfile } from '../eas/profiles'
import { planSync } from '../sync/plan'
import { NOW, easBuild, uuid } from './helpers'

const DEVELOPMENT: SyncProfile = {
  name: 'development',
  platforms: ['ANDROID', 'IOS'],
}

function actions(plan: ReturnType<typeof planSync>) {
  return plan.map((item) => [item.build.id, item.action])
}

describe('planSync', () => {
  it('downloads a new build, keeps a stored one, and skips an expired one', () => {
    const fresh = easBuild({ id: uuid(1) })
    const stored = easBuild({ id: uuid(2) })
    const expired = easBuild({
      id: uuid(3),
      expirationDate: '2026-10-01T00:00:00.000Z',
    })

    const plan = planSync({
      profileBuilds: [
        { profile: DEVELOPMENT, builds: [fresh, stored, expired] },
      ],
      storedIds: new Set([uuid(2)]),
      now: NOW,
    })

    expect(actions(plan)).toEqual([
      [uuid(1), 'download'],
      [uuid(2), 'stored'],
      [uuid(3), 'expired'],
    ])
    expect(plan[0]).toMatchObject({
      profile: 'development',
      url: `https://expo.dev/artifacts/eas/${uuid(1)}.apk`,
    })
  })

  it('keeps a stored build stored after EAS deletes it', () => {
    const plan = planSync({
      profileBuilds: [
        {
          profile: DEVELOPMENT,
          builds: [
            easBuild({ id: uuid(1), expirationDate: '2026-01-01T00:00:00Z' }),
          ],
        },
      ],
      storedIds: new Set([uuid(1)]),
      now: NOW,
    })

    expect(actions(plan)).toEqual([[uuid(1), 'stored']])
  })

  it('treats a build that expires at this moment as expired', () => {
    const plan = planSync({
      profileBuilds: [
        {
          profile: DEVELOPMENT,
          builds: [easBuild({ expirationDate: NOW.toISOString() })],
        },
      ],
      storedIds: new Set(),
      now: NOW,
    })

    expect(plan[0]?.action).toBe('expired')
  })

  it('downloads a build with no expiry date', () => {
    const build = easBuild()
    delete build.expirationDate

    const plan = planSync({
      profileBuilds: [{ profile: DEVELOPMENT, builds: [build] }],
      storedIds: new Set(),
      now: NOW,
    })

    expect(plan[0]?.action).toBe('download')
  })

  it('uses the build URL when the application archive URL is empty', () => {
    const plan = planSync({
      profileBuilds: [
        {
          profile: DEVELOPMENT,
          builds: [
            easBuild({
              artifacts: {
                applicationArchiveUrl: '',
                buildUrl: 'https://expo.dev/artifacts/eas/b.tar.gz',
              },
            }),
            easBuild({ id: uuid(2), artifacts: {} }),
          ],
        },
      ],
      storedIds: new Set(),
      now: NOW,
    })

    expect(plan[0]).toMatchObject({
      action: 'download',
      url: 'https://expo.dev/artifacts/eas/b.tar.gz',
    })
    expect(plan[1]?.action).toBe('no-artifact')
  })

  it('keeps APKs, iOS simulator builds, and iOS device builds', () => {
    const plan = planSync({
      profileBuilds: [
        {
          profile: DEVELOPMENT,
          builds: [
            easBuild({ id: uuid(1), platform: 'ANDROID' }),
            easBuild({ id: uuid(2), platform: 'IOS', isForIosSimulator: true }),
            easBuild({
              id: uuid(3),
              platform: 'IOS',
              isForIosSimulator: false,
            }),
          ],
        },
      ],
      storedIds: new Set(),
      now: NOW,
    })

    expect(plan.map((item) => item.action)).toEqual([
      'download',
      'download',
      'download',
    ])
  })

  it('leaves out a platform that the profile does not make a dev client for', () => {
    const plan = planSync({
      profileBuilds: [
        {
          profile: { name: 'development', platforms: ['IOS'] },
          builds: [
            easBuild({ id: uuid(1), platform: 'ANDROID' }),
            easBuild({ id: uuid(2), platform: 'IOS' }),
          ],
        },
      ],
      storedIds: new Set(),
      now: NOW,
    })

    expect(actions(plan)).toEqual([[uuid(2), 'download']])
  })

  it('plans a build once when two profiles list it', () => {
    const build = easBuild()
    const plan = planSync({
      profileBuilds: [
        { profile: DEVELOPMENT, builds: [build] },
        { profile: { ...DEVELOPMENT, name: 'other' }, builds: [build] },
      ],
      storedIds: new Set(),
      now: NOW,
    })

    expect(plan).toHaveLength(1)
  })

  it('refuses an ID that cannot be a folder name', () => {
    const plan = planSync({
      profileBuilds: [
        { profile: DEVELOPMENT, builds: [easBuild({ id: '../escape' })] },
      ],
      storedIds: new Set(),
      now: NOW,
    })

    expect(plan[0]?.action).toBe('invalid-id')
  })
})
