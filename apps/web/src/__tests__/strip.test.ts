import { describe, expect, it } from 'vitest'
import type { BuildList, Device, DoctorReport, ListedBuild } from '../api/types'
import { buildCells, clock, deviceCells, setupCells } from '../logic/strip'
import { platformOf } from '../logic/summary'

const NOW = new Date('2026-11-09T12:00:00.000Z')

function eas(
  id: string,
  slug: string,
  extra: {
    platform?: string
    createdAt?: string
    expirationDate?: string
    appVersion?: string
    gitCommitHash?: string
    size?: number
  } = {},
): ListedBuild {
  return {
    id,
    source: 'eas',
    path: `/store/builds/${id}/app`,
    size: extra.size ?? 1_000_000,
    storedAt: '2026-11-01T10:00:00.000Z',
    eas: {
      id,
      platform: extra.platform ?? 'ANDROID',
      app: { slug },
      createdAt: extra.createdAt,
      expirationDate: extra.expirationDate,
      appVersion: extra.appVersion,
      gitCommitHash: extra.gitCommitHash,
    },
  }
}

function local(id: string, slug: string, platform: string): ListedBuild {
  return {
    id,
    source: 'local',
    path: `/store/local/${id}/app`,
    size: 3_000_000,
    storedAt: '2026-11-08T10:00:00.000Z',
    local: {
      platform,
      fingerprintHash: 'f'.repeat(40),
      variant: 'debug',
      project: `/work/${slug}`,
      slug,
      appVersion: '1.4.0',
    },
  }
}

function list(builds: ListedBuild[]): BuildList {
  return { store: '/store', builds, incomplete: [], unreadable: [] }
}

const STORE = list([
  eas('a', 'shop-app', {
    createdAt: '2026-11-09T09:00:00.000Z',
    expirationDate: '2026-12-09T09:00:00.000Z',
    appVersion: '1.4.0',
    gitCommitHash: '7c9e2f1a9b8c',
    size: 84_200_000,
  }),
  eas('b', 'shop-app', {
    platform: 'IOS',
    createdAt: '2026-11-07T09:00:00.000Z',
    expirationDate: '2026-11-01T09:00:00.000Z',
    size: 91_700_000,
  }),
  local('c', 'shop-app', 'ANDROID'),
  eas('d', 'notes', {
    createdAt: '2026-11-09T11:00:00.000Z',
    expirationDate: '2026-11-20T09:00:00.000Z',
    appVersion: '2.0.1',
  }),
])

describe('buildCells', () => {
  it('gives the facts of one project', () => {
    expect(buildCells(STORE, 'shop-app', NOW)).toEqual([
      {
        key: 'builds',
        label: 'Builds',
        value: '3',
        detail: '2 Android · 1 iOS',
        hue: 'violet',
        icon: 'builds',
      },
      {
        key: 'latest',
        label: 'Latest build',
        value: '2026-11-09',
        detail: 'Version 1.4.0 · commit 7c9e2f1',
        hue: 'sky',
        icon: 'latest',
      },
      {
        key: 'size',
        label: 'Size of the builds',
        value: '178.9 MB',
        detail: 'Largest: 91.7 MB',
        hue: 'teal',
        icon: 'size',
      },
      {
        key: 'expiry',
        label: 'Next EAS expiry',
        value: '2026-12-09',
        detail: 'EAS deleted 1 copy',
        hue: 'red',
        icon: 'expiry',
        detailHue: 'red',
      },
    ])
  })

  it('names the project of the latest build for all projects', () => {
    const [builds, latest, , expiry] = buildCells(STORE, undefined, NOW)
    expect(builds?.value).toBe('4')
    expect(latest?.detail).toBe('notes · 2.0.1')
    expect(expiry?.value).toBe('2026-11-20')
  })

  it('says when no build or no EAS build is in the selection', () => {
    const cells = buildCells(list([local('c', 'app', 'IOS')]), 'app', NOW)
    expect(cells.map((cell) => cell.detail)).toEqual([
      '0 Android · 1 iOS',
      'Version 1.4.0 · commit -',
      'Largest: 3.0 MB',
      'No EAS builds',
    ])
    const empty = buildCells(list([]), undefined, NOW)
    expect(empty.map((cell) => [cell.value, cell.detail])).toEqual([
      ['0', '0 Android · 0 iOS'],
      ['-', 'No builds'],
      ['0 B', 'No builds'],
      ['-', 'No EAS builds'],
    ])
  })

  it('says that EAS keeps each copy when none expired', () => {
    const [, , , expiry] = buildCells(STORE, 'notes', NOW)
    expect(expiry).toMatchObject({
      detail: 'EAS keeps each copy',
      hue: 'slate',
    })
    expect(expiry?.detailHue).toBeUndefined()
  })
})

const PIXEL: Device = {
  platform: 'android',
  kind: 'emulator',
  id: 'emulator-5554',
  name: 'Pixel 8',
  state: 'device',
  ready: true,
}
const PHONE: Device = {
  platform: 'android',
  kind: 'physical',
  id: 'R5CT80',
  name: 'R5CT80',
  state: 'unauthorized',
  ready: false,
}
const IPHONE: Device = {
  platform: 'ios',
  kind: 'simulator',
  id: 'UDID-1',
  name: 'iPhone 16',
  state: 'Booted',
  ready: true,
  osVersion: '26.1',
}

describe('deviceCells', () => {
  it('counts the ready devices, each platform, and the devices to fix', () => {
    expect(
      deviceCells({ devices: [PIXEL, PHONE, IPHONE], warnings: [] }).map(
        ({ key, value, detail, hue, detailHue }) => ({
          key,
          value,
          detail,
          hue,
          detailHue,
        }),
      ),
    ).toEqual([
      {
        key: 'ready',
        value: '2 of 3',
        detail: '1 not ready',
        hue: 'green',
        detailHue: undefined,
      },
      {
        key: 'android',
        value: '2',
        detail: '1 emulator · 1 device',
        hue: 'green',
        detailHue: undefined,
      },
      {
        key: 'ios',
        value: '1',
        detail: '1 simulator',
        hue: 'blue',
        detailHue: undefined,
      },
      {
        key: 'fix',
        value: '1',
        detail: 'R5CT80: unauthorized',
        hue: 'red',
        detailHue: 'red',
      },
    ])
  })

  it('says when no device runs', () => {
    expect(
      deviceCells({ devices: [], warnings: [] }).map((cell) => cell.detail),
    ).toEqual(['No device runs', 'None', 'None', 'Nothing'])
  })
})

const REPORT: DoctorReport = {
  checks: [
    { id: 'node', label: 'Node', status: 'ok', detail: '24.11.0' },
    { id: 'store', label: 'Store', status: 'ok', detail: 'Writable.' },
    { id: 'eas', label: 'EAS', status: 'ok', detail: 'Signed in.' },
    { id: 'android', label: 'Android', status: 'ok', detail: 'adb 36.0.0' },
    {
      id: 'ios',
      label: 'iOS',
      status: 'warn',
      detail: 'xcodebuild failed.',
      fix: 'Install Xcode.',
    },
  ],
}

describe('setupCells', () => {
  it('has no counts before the first check', () => {
    expect(
      setupCells({ running: false }).map((cell) => [cell.value, cell.detail]),
    ).toEqual([
      ['-', 'Not run yet'],
      ['-', 'No result'],
      ['-', 'No result'],
      ['-', 'No result'],
    ])
  })

  it('counts each state and names the checks, with the time of the check', () => {
    const cells = setupCells({
      running: false,
      result: { kind: 'ok', value: REPORT },
      checkedAt: new Date(2026, 10, 9, 14, 5),
    })
    expect(
      cells.map(({ value, detail, hue, detailHue }) => [
        value,
        detail,
        hue,
        detailHue,
      ]),
    ).toEqual([
      ['5', 'Checked at 14:05', 'amber', undefined],
      ['4', 'Node, Store, EAS, Android', 'green', undefined],
      ['1', 'iOS', 'amber', 'amber'],
      ['0', 'Nothing blocks DevHub', 'slate', undefined],
    ])
  })

  it('keeps the last counts while the checks run again', () => {
    const [checks, ok] = setupCells({
      running: true,
      result: { kind: 'ok', value: REPORT },
    })
    expect(checks?.detail).toBe('Running the checks')
    expect(ok?.value).toBe('4')
  })

  it('says when the check did not run', () => {
    const [checks] = setupCells({
      running: false,
      result: { kind: 'error', message: 'No answer.' },
    })
    expect(checks).toMatchObject({
      detail: 'The check did not run',
      detailHue: 'red',
    })
  })
})

describe('clock', () => {
  it('gives the hours and the minutes with two digits each', () => {
    expect(clock(new Date(2026, 0, 1, 9, 3))).toBe('09:03')
  })
})

describe('platformOf', () => {
  it('gives the device platform of an EAS and a local build', () => {
    expect(platformOf(eas('a', 'app', { platform: 'IOS' }))).toBe('ios')
    expect(platformOf(local('c', 'app', 'ANDROID'))).toBe('android')
  })
})
