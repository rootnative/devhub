import { describe, expect, it } from 'vitest'
import type {
  BuildList,
  Device,
  EasBuild,
  ListedBuild,
  LocalBuild,
} from '../api/types'
import { formatBytes, platformLabel, shortIds } from '../logic/format'
import { installChoice, installedMessage } from '../logic/install'
import { resolveToken } from '../logic/token'
import {
  buildColumns,
  deviceRow,
  groupBuilds,
  storeLine,
  storeNotes,
} from '../logic/view'

const NOW = new Date('2026-10-18T12:00:00.000Z')

function listed(id: string, eas: Partial<EasBuild> = {}): ListedBuild {
  return {
    id,
    source: 'eas',
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
      app: { slug: 'demo-app' },
      ...eas,
    },
  }
}

function listedLocal(id: string, local: Partial<LocalBuild> = {}): ListedBuild {
  return {
    id,
    source: 'local',
    path: `/store/builds/${id}/app.apk`,
    size: 98_500_000,
    storedAt: '2026-10-17T10:00:00.000Z',
    local: {
      platform: 'ANDROID',
      fingerprintHash: '3333333333333333333333333333333333333333',
      variant: 'debug',
      project: '/work/my-app',
      appVersion: '2.4.0',
      gitCommitHash: '89abcdef0123',
      ...local,
    },
  }
}

const STORE = '/Users/ana/Library/Application Support/devhub'

function list(builds: ListedBuild[], extra: Partial<BuildList> = {}) {
  return { store: STORE, builds, incomplete: [], unreadable: [], ...extra }
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
        listed('aaaa1111-0000', { app: { slug: 'demo-app' } }),
        listed('bbbb2222-0000', { app: { slug: 'demo-app' } }),
        listed('cccc3333-0000', { app: { name: 'Demo Notes' } }),
        listed('dddd4444-0000', { app: undefined }),
      ]),
      NOW,
    )

    expect(groups.map((group) => group.project)).toEqual([
      'demo-app',
      'Demo Notes',
      '-',
    ])
    expect(groups[0]?.builds.map((build) => build.shortId)).toEqual([
      'aaaa1111',
      'bbbb2222',
    ])
  })

  it('gives each row the fields of devhub list', () => {
    const build = listed('aaaa1111-0000')
    const [group] = groupBuilds(list([build]), NOW)

    expect(group?.builds[0]).toEqual({
      id: 'aaaa1111-0000',
      build,
      shortId: 'aaaa1111',
      title: 'Android · development',
      details: 'Version 2.3.2 · commit b44e6ca · created 2026-10-06',
      expiry: 'EAS deletes its copy on 2026-10-20',
      size: '214.8 MB',
      cells: buildColumns(build, 'aaaa1111', NOW),
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

describe('buildColumns', () => {
  it('gives each cell of an EAS build', () => {
    const hash = 'd27c0622a1b2c3d4e5f60718293a4b5c6d7e8f90'
    const build = listed('aaaa1111-0000', { fingerprint: { hash } })

    expect(buildColumns(build, 'aaaa1111', NOW)).toEqual({
      id: 'aaaa1111',
      platform: 'Android',
      profile: 'development',
      version: '2.3.2',
      commit: 'b44e6ca',
      created: '2026-10-06',
      expiry: '2026-10-20',
      expired: false,
      fingerprint: 'd27c0622',
      fingerprintHash: hash,
      size: '214.8 MB',
    })
  })

  it('gives - for each value that the record does not have', () => {
    const build = listed('aaaa1111-0000', {
      platform: 'IOS',
      isForIosSimulator: true,
      buildProfile: undefined,
      appVersion: undefined,
      gitCommitHash: undefined,
      expirationDate: undefined,
    })

    const cells = buildColumns(build, 'aaaa1111', NOW)

    expect(cells).toMatchObject({
      platform: 'iOS simulator',
      profile: '-',
      version: '-',
      commit: '-',
      expiry: '-',
      expired: false,
      fingerprint: '-',
    })
    expect('fingerprintHash' in cells).toBe(false)
  })

  it('marks an expiry date in the past', () => {
    const build = listed('aaaa1111-0000', {
      expirationDate: '2026-10-01T00:00:00.000Z',
    })

    expect(buildColumns(build, 'aaaa1111', NOW)).toMatchObject({
      expiry: '2026-10-01',
      expired: true,
    })
  })

  it('gives the store date and the fingerprint of a local build', () => {
    const build = listedLocal('bbbb2222-0000')

    expect(buildColumns(build, 'bbbb2222', NOW)).toMatchObject({
      platform: 'Android',
      profile: 'local debug',
      version: '2.4.0',
      commit: '89abcde',
      created: '2026-10-17',
      expiry: '-',
      expired: false,
      fingerprint: '33333333',
      fingerprintHash: '3333333333333333333333333333333333333333',
      size: '98.5 MB',
    })
  })
})

describe('groupBuilds with local builds', () => {
  it('shows a local build in the group of its project, with no expiry', () => {
    const groups = groupBuilds(
      list([
        listed('aaaa1111-0000', { app: { slug: 'my-app' } }),
        listedLocal('bbbb2222-0000'),
        listedLocal('cccc3333-0000', {
          platform: 'IOS',
          variant: 'Debug',
          project: 'C:\\work\\other-app\\',
        }),
      ]),
      NOW,
    )

    expect(groups.map((group) => group.project)).toEqual([
      'my-app',
      'other-app',
    ])
    expect(groups[0]?.builds[1]).toMatchObject({
      title: 'Android · local debug',
      details: 'Version 2.4.0 · commit 89abcde · stored 2026-10-17',
      expiry: '',
    })
    expect(groups[1]?.builds[0]?.title).toBe('iOS simulator · local Debug')
  })

  it('uses the slug of the app config when the build has one', () => {
    const [group] = groupBuilds(
      list([listedLocal('aaaa1111-0000', { slug: 'sample-app' })]),
      NOW,
    )

    expect(group?.project).toBe('sample-app')
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

describe('storeLine', () => {
  it('names the store folder of the list', () => {
    expect(storeLine({ kind: 'ok', value: list([]) })).toBe(`Store: ${STORE}`)
  })

  it('says when the page reads or cannot read the store', () => {
    expect(storeLine({ kind: 'loading' })).toBe('Reading the store.')
    expect(storeLine({ kind: 'error', message: 'EACCES' })).toBe(
      'DevHub cannot read the store.',
    )
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
      kind: 'Android emulator',
      deviceId: 'emulator-5554',
      status: 'Ready',
      ready: true,
      problem: undefined,
    })
  })

  it('shows the state and the fix of a device that is not ready, and the ID once', () => {
    const row = deviceRow({
      ...emulator,
      kind: 'physical',
      id: 'R58M12ABCDE',
      name: 'R58M12ABCDE',
      state: 'unauthorized',
      ready: false,
      problem: 'Accept the USB debugging prompt on the device.',
    })

    expect(row).toMatchObject({
      title: 'R58M12ABCDE',
      kind: 'Android device',
      status: 'unauthorized',
      ready: false,
      problem: 'Accept the USB debugging prompt on the device.',
    })
    expect('deviceId' in row).toBe(false)
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
      kind: 'iOS simulator',
      deviceId: '188FFDBB',
    })
  })
})

describe('installChoice', () => {
  const device = (overrides: Partial<Device>): Device => ({
    platform: 'android',
    kind: 'emulator',
    id: 'emulator-5554',
    name: 'Pixel_Light_34',
    state: 'device',
    ready: true,
    ...overrides,
  })
  const emulator = device({})
  const phone = device({ kind: 'physical', id: 'R58M', name: 'Nokia C32' })
  const unauthorized = device({ id: 'X1', state: 'unauthorized', ready: false })
  const simulator = device({
    platform: 'ios',
    kind: 'simulator',
    id: '188FFDBB',
    name: 'iPhone 16 Pro',
    state: 'Booted',
    osVersion: '18.6',
  })

  it('installs on the one ready device of the platform', () => {
    expect(
      installChoice(listed('a'), [simulator, unauthorized, emulator]),
    ).toEqual({ kind: 'one', device: emulator })
    expect(
      installChoice(listed('b', { platform: 'IOS', isForIosSimulator: true }), [
        emulator,
        simulator,
      ]),
    ).toEqual({ kind: 'one', device: simulator })
  })

  it('reads the platform of a local build', () => {
    expect(
      installChoice(listedLocal('c', { platform: 'IOS' }), [
        emulator,
        simulator,
      ]),
    ).toEqual({ kind: 'one', device: simulator })
  })

  it('lets the user select when two or more devices are ready', () => {
    expect(installChoice(listed('a'), [emulator, simulator, phone])).toEqual({
      kind: 'many',
      devices: [emulator, phone],
    })
  })

  it('has no device when none of the platform is ready, or no list is read', () => {
    expect(installChoice(listed('a'), [simulator, unauthorized])).toEqual({
      kind: 'no-device',
    })
    expect(installChoice(listed('a'), [])).toEqual({ kind: 'no-device' })
    expect(installChoice(listed('a'), undefined)).toEqual({
      kind: 'no-device',
    })
  })

  it('refuses a build that devhub install refuses, before it looks at a device', () => {
    const aab = {
      ...listed('a'),
      installProblem: 'The build a is an Android App Bundle (app.aab).',
    }

    expect(installChoice(aab, [emulator])).toEqual({
      kind: 'refused',
      reason: 'The build a is an Android App Bundle (app.aab).',
    })
  })

  it('names the device in the success message', () => {
    expect(installedMessage('aaaa1111', simulator)).toBe(
      'Installed the build aaaa1111 on iPhone 16 Pro (iOS 18.6).',
    )
  })
})
