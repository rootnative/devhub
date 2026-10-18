import { describe, expect, it } from 'vitest'
import type { BuildList, Device, EasBuild, ListedBuild } from '../api/types'
import { formatBytes, platformLabel, shortIds } from '../logic/format'
import { resolveToken } from '../logic/token'
import { deviceRow, groupBuilds, storeNotes } from '../logic/view'

const NOW = new Date('2026-10-18T12:00:00.000Z')

function listed(id: string, eas: Partial<EasBuild> = {}): ListedBuild {
  return {
    id,
    path: `/store/builds/${id}/app.apk`,
    size: 214_795_512,
    storedAt: '2026-10-17T10:00:00.000Z',
    eas: {
      id,
      platform: 'ANDROID',
      buildProfile: 'development',
      appVersion: '2.3.2',
      gitCommitHash: 'b44e6ca0123456789',
      createdAt: '2026-10-06T08:00:00.000Z',
      expirationDate: '2026-10-20T08:00:00.000Z',
      app: { slug: 'fargo' },
      ...eas,
    },
  }
}

function list(builds: ListedBuild[], extra: Partial<BuildList> = {}) {
  return { builds, incomplete: [], unreadable: [], ...extra }
}

describe('resolveToken', () => {
  it('takes the token from the fragment, and it wins over a stored one', () => {
    expect(resolveToken('#token=abc-_1', 'old')).toEqual({
      token: 'abc-_1',
      fromHash: true,
    })
  })

  it('uses the stored token when the fragment has none', () => {
    expect(resolveToken('', 'stored')).toEqual({
      token: 'stored',
      fromHash: false,
    })
    expect(resolveToken('#other=1', 'stored')).toEqual({
      token: 'stored',
      fromHash: false,
    })
  })

  it.each([
    ['', null],
    ['#token=', null],
    ['#token=', ''],
  ])(
    'has no token for the fragment %j and the stored value %j',
    (hash, stored) => {
      expect(resolveToken(hash, stored).token).toBeUndefined()
    },
  )
})

describe('format', () => {
  it('makes short IDs unique, the same as the CLI', () => {
    const short = shortIds(['aaaa1111-1', 'aaaa1111-2', 'bbbb2222-3'])

    expect(short('aaaa1111-1')).toBe('aaaa1111-1')
    expect(short('bbbb2222-3')).toBe('bbbb2222-3')
    expect(shortIds(['aaaa1111-1', 'bbbb2222-3'])('aaaa1111-1')).toBe(
      'aaaa1111',
    )
  })

  it.each([
    ['ANDROID', undefined, 'Android'],
    ['IOS', true, 'iOS simulator'],
    ['IOS', false, 'iOS device'],
    ['IOS', undefined, 'iOS device'],
  ] as const)(
    'labels %s (simulator %s) as %s',
    (platform, simulator, label) => {
      expect(platformLabel(platform, simulator)).toBe(label)
    },
  )

  it('formats sizes with the units of the CLI', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(214_795_512)).toBe('214.8 MB')
  })
})

describe('groupBuilds', () => {
  it('groups the builds by project in the order of the list', () => {
    const groups = groupBuilds(
      list([
        listed('aaaa1111-0000', { app: { slug: 'fargo' } }),
        listed('bbbb2222-0000', { app: { slug: 'fargo' } }),
        listed('cccc3333-0000', { app: { name: 'Reelist' } }),
        listed('dddd4444-0000', { app: undefined }),
      ]),
      NOW,
    )

    expect(groups.map((group) => group.project)).toEqual([
      'fargo',
      'Reelist',
      '-',
    ])
    expect(groups[0]?.builds.map((build) => build.shortId)).toEqual([
      'aaaa1111',
      'bbbb2222',
    ])
  })

  it('gives each row the fields of devhub list', () => {
    const [group] = groupBuilds(list([listed('aaaa1111-0000')]), NOW)

    expect(group?.builds[0]).toEqual({
      id: 'aaaa1111-0000',
      shortId: 'aaaa1111',
      title: 'Android · development',
      details: 'Version 2.3.2 · commit b44e6ca · created 2026-10-06',
      expiry: 'EAS deletes its copy on 2026-10-20',
      size: '214.8 MB',
    })
  })

  it('says when EAS deleted its copy, and gives no expiry without a date', () => {
    const [group] = groupBuilds(
      list([
        listed('aaaa1111-0000', {
          platform: 'IOS',
          isForIosSimulator: true,
          expirationDate: '2026-10-01T00:00:00.000Z',
          appVersion: undefined,
          gitCommitHash: undefined,
        }),
        listed('bbbb2222-0000', { expirationDate: undefined }),
      ]),
      NOW,
    )

    expect(group?.builds[0]).toMatchObject({
      title: 'iOS simulator · development',
      details: 'Version - · commit - · created 2026-10-06',
      expiry: 'EAS deleted its copy on 2026-10-01',
    })
    expect(group?.builds[1]?.expiry).toBe('')
  })
})

describe('storeNotes', () => {
  it('gives the notes of devhub list', () => {
    expect(storeNotes(list([]))).toEqual([])
    expect(
      storeNotes(
        list([], {
          incomplete: ['x'],
          unreadable: [{ id: 'y', reason: 'The JSON is not valid.' }],
        }),
      ),
    ).toEqual([
      'The store has 1 incomplete build folder. The next devhub sync replaces it.',
      'DevHub cannot read the build y. The JSON is not valid.',
    ])
    expect(storeNotes(list([], { incomplete: ['x', 'z'] }))).toEqual([
      'The store has 2 incomplete build folders. The next devhub sync replaces them.',
    ])
  })
})

describe('deviceRow', () => {
  const emulator: Device = {
    platform: 'android',
    kind: 'emulator',
    id: 'emulator-5554',
    name: 'Pixel_Light_34',
    state: 'device',
    ready: true,
  }

  it('shows a ready device', () => {
    expect(deviceRow(emulator)).toEqual({
      id: 'emulator-5554',
      title: 'Pixel_Light_34',
      details: 'Android emulator · emulator-5554',
      status: 'Ready',
      ready: true,
      problem: undefined,
    })
  })

  it('shows the state and the fix of a device that is not ready', () => {
    expect(
      deviceRow({
        ...emulator,
        kind: 'physical',
        id: 'R58M12ABCDE',
        name: 'R58M12ABCDE',
        state: 'unauthorized',
        ready: false,
        problem: 'Accept the USB debugging prompt on the device.',
      }),
    ).toMatchObject({
      details: 'Android device · R58M12ABCDE',
      status: 'unauthorized',
      problem: 'Accept the USB debugging prompt on the device.',
    })
  })

  it('shows the iOS version of a simulator', () => {
    expect(
      deviceRow({
        platform: 'ios',
        kind: 'simulator',
        id: '188FFDBB',
        name: 'iPhone 16 Pro',
        state: 'Booted',
        ready: true,
        osVersion: '18.6',
      }),
    ).toMatchObject({
      title: 'iPhone 16 Pro (iOS 18.6)',
      details: 'iOS simulator · 188FFDBB',
    })
  })
})
