import { describe, expect, it } from 'vitest'
import type { BuildList, Device, ListedBuild } from '../api/types'
import {
  buildCount,
  countLabel,
  deviceValue,
  devicesWarning,
  keepProject,
  parsePage,
  projectCounts,
  projectInitials,
  projectTone,
  scopeCount,
  setupMark,
  sidebarDevices,
  switchChoices,
} from '../logic/sidebar'

function build(id: string, slug: string): ListedBuild {
  return {
    id,
    source: 'eas',
    path: `/store/builds/${id}/app.apk`,
    size: 1000,
    storedAt: '2026-10-17T10:00:00.000Z',
    eas: { id, platform: 'ANDROID', app: { slug } },
  }
}

function list(builds: ListedBuild[]): BuildList {
  return { store: '/store', builds, incomplete: [], unreadable: [] }
}

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
  problem: 'Allow USB debugging on the device.',
}

const STORE = list([
  build('a', 'shop-app'),
  build('b', 'notes'),
  build('c', 'shop-app'),
])

describe('parsePage', () => {
  it('gives the page of each item', () => {
    expect(parsePage('builds')).toBe('builds')
    expect(parsePage('devices')).toBe('devices')
    expect(parsePage('setup')).toBe('setup')
  })

  it('opens the Devices page from the item of a device', () => {
    expect(parsePage(deviceValue(PIXEL))).toBe('devices')
  })

  it('opens the builds for a value that it does not know', () => {
    expect(parsePage('other')).toBe('builds')
  })
})

describe('projectCounts', () => {
  it('counts the builds of each project, in the order of the list', () => {
    expect(projectCounts(STORE)).toEqual([
      { project: 'shop-app', count: 2 },
      { project: 'notes', count: 1 },
    ])
  })

  it('gives no project for an empty store', () => {
    expect(projectCounts(list([]))).toEqual([])
  })
})

describe('keepProject', () => {
  it('keeps a project that the list has', () => {
    expect(keepProject('shop-app', STORE)).toBe('shop-app')
  })

  it('goes back to all projects when the list no longer has the project', () => {
    expect(keepProject('shop-app', list([build('b', 'notes')]))).toBe(undefined)
  })

  it('keeps the project while the page has no build list', () => {
    expect(keepProject('shop-app', undefined)).toBe('shop-app')
  })

  it('keeps all projects', () => {
    expect(keepProject(undefined, STORE)).toBe(undefined)
  })
})

describe('scopeCount', () => {
  it('counts the builds of the project, or of the store', () => {
    expect(scopeCount(STORE, 'shop-app')).toBe(2)
    expect(scopeCount(STORE, undefined)).toBe(3)
    expect(scopeCount(STORE, 'gone')).toBe(0)
  })
})

describe('switchChoices', () => {
  const counts = projectCounts(STORE)

  it('offers the other projects and All projects for a project', () => {
    expect(switchChoices(counts, 'shop-app')).toEqual({
      projects: [{ project: 'notes', count: 1 }],
      all: true,
    })
  })

  it('offers each project and not All projects for all projects', () => {
    expect(switchChoices(counts, undefined)).toEqual({
      projects: counts,
      all: false,
    })
  })
})

describe('projectInitials', () => {
  it.each([
    ['shop-app', 'SA'],
    ['notes', 'N'],
    ['field-service-inspection-companion', 'FS'],
    ['my_app', 'MA'],
    ['MyApp', 'MA'],
    ['2fa app', '2A'],
  ])('gives %s the initials %s', (project, initials) => {
    expect(projectInitials(project)).toBe(initials)
  })
})

describe('projectTone', () => {
  it('gives the same name the same tone, and other names other tones', () => {
    expect(projectTone('shop-app', 4)).toBe(projectTone('shop-app', 4))
    const tones = new Set(
      ['shop-app', 'notes', 'field-service', 'reader', 'maps'].map((name) =>
        projectTone(name, 4),
      ),
    )
    expect(tones.size).toBeGreaterThan(1)
    for (const tone of tones) {
      expect(tone).toBeGreaterThanOrEqual(0)
      expect(tone).toBeLessThan(4)
    }
  })
})

describe('buildCount and countLabel', () => {
  it('says build for one and builds for more', () => {
    expect(buildCount(1)).toBe('1 build')
    expect(buildCount(5)).toBe('5 builds')
    expect(countLabel('shop-app', 5)).toBe('shop-app. 5 builds')
  })
})

describe('sidebarDevices', () => {
  it('gives the name, the state, and a value for each device', () => {
    expect(sidebarDevices([PIXEL, PHONE])).toEqual([
      {
        value: 'device:emulator-5554',
        label: 'Pixel 8',
        ready: true,
        accessibilityLabel: 'Pixel 8. Ready',
      },
      {
        value: 'device:R5CT80',
        label: 'R5CT80',
        ready: false,
        accessibilityLabel: 'R5CT80. unauthorized',
      },
    ])
  })
})

describe('devicesWarning', () => {
  it('is on for a warning of the device list and for an error', () => {
    expect(
      devicesWarning({
        kind: 'ok',
        value: { devices: [], warnings: ['adb is not on PATH.'] },
      }),
    ).toBe(true)
    expect(devicesWarning({ kind: 'error', message: 'No answer.' })).toBe(true)
  })

  it('is off while the page reads the devices, and with no warning', () => {
    expect(devicesWarning({ kind: 'loading' })).toBe(false)
    expect(
      devicesWarning({ kind: 'ok', value: { devices: [PHONE], warnings: [] } }),
    ).toBe(false)
  })
})

describe('setupMark', () => {
  it('shows the check icon before a check, and after a failed call', () => {
    const before = {
      icon: 'setup-check',
      problems: 0,
      accessibilityLabel: 'Setup',
    }
    expect(setupMark(undefined)).toEqual(before)
    expect(setupMark({ kind: 'error', message: 'No answer.' })).toEqual(before)
  })

  it('counts the warnings and the failures, and shows the worst state', () => {
    const mark = setupMark({
      kind: 'ok',
      value: {
        checks: [
          { id: 'node', label: 'Node', status: 'ok', detail: 'Node 24' },
          { id: 'eas', label: 'EAS', status: 'warn', detail: 'No login' },
          { id: 'android', label: 'Android', status: 'fail', detail: 'No adb' },
          { id: 'ios', label: 'iOS', status: 'skip', detail: 'Not macOS' },
        ],
      },
    })
    expect(mark).toEqual({
      icon: 'status-fail',
      problems: 2,
      accessibilityLabel: 'Setup. 2 checks need a fix.',
    })
  })

  it('shows the OK icon and no count when no check has a problem', () => {
    const mark = setupMark({
      kind: 'ok',
      value: {
        checks: [
          { id: 'node', label: 'Node', status: 'ok', detail: 'Node 24' },
        ],
      },
    })
    expect(mark).toEqual({
      icon: 'status-ok',
      problems: 0,
      accessibilityLabel: 'Setup. No problems found.',
    })
  })
})
