import { describe, expect, it } from 'vitest'
import type { Device, EasBuild, ListedBuild } from '../api/types'
import {
  NO_DEVICE,
  installOnLabel,
  installTargets,
  keepChosen,
  pickerView,
  rowInstall,
} from '../logic/install'

function device(overrides: Partial<Device>): Device {
  return {
    platform: 'android',
    kind: 'emulator',
    id: 'emulator-5554',
    name: 'Pixel 8',
    state: 'device',
    ready: true,
    ...overrides,
  }
}

const PIXEL = device({})
const TABLET = device({ id: 'emulator-5556', name: 'Pixel Tablet' })
const PHONE = device({ kind: 'physical', id: 'R58M', name: 'Nokia C32' })
const OFFLINE = device({ id: 'X1', name: 'X1', state: 'offline', ready: false })
const IPHONE = device({
  platform: 'ios',
  kind: 'simulator',
  id: '188FFDBB',
  name: 'iPhone 16',
  state: 'Booted',
  osVersion: '18.6',
})

function build(id: string, eas: Partial<EasBuild> = {}): ListedBuild {
  return {
    id,
    source: 'eas',
    path: `/store/builds/${id}/app.apk`,
    size: 1000,
    storedAt: '2026-10-17T10:00:00.000Z',
    eas: { id, platform: 'ANDROID', ...eas },
  }
}

const IOS_BUILD = build('b', { platform: 'IOS', isForIosSimulator: true })

describe('installTargets', () => {
  it('uses the one ready device of each platform with no selection', () => {
    expect(installTargets([PIXEL, OFFLINE, IPHONE], {})).toEqual({
      android: PIXEL,
      ios: IPHONE,
    })
  })

  it('has no target for a platform with two ready devices and no selection', () => {
    expect(installTargets([PIXEL, TABLET, IPHONE], {})).toEqual({
      ios: IPHONE,
    })
  })

  it('uses the selected device of a platform', () => {
    expect(
      installTargets([PIXEL, TABLET, IPHONE], { android: 'emulator-5556' }),
    ).toEqual({ android: TABLET, ios: IPHONE })
  })

  it('goes back to the auto rule when the selected device is not ready', () => {
    expect(installTargets([PIXEL, OFFLINE], { android: 'X1' })).toEqual({
      android: PIXEL,
    })
    expect(installTargets([PIXEL, TABLET], { android: 'R58M' })).toEqual({})
  })

  it('has no target with no device list', () => {
    expect(installTargets(undefined, { android: 'emulator-5554' })).toEqual({})
    expect(installTargets([], {})).toEqual({})
  })
})

describe('keepChosen', () => {
  it('keeps a selection while its device is ready', () => {
    const chosen = { android: 'emulator-5556', ios: '188FFDBB' }

    expect(keepChosen(chosen, [PIXEL, TABLET, IPHONE])).toBe(chosen)
  })

  it('drops the selection of a device that stopped or is not ready', () => {
    expect(
      keepChosen({ android: 'emulator-5556', ios: '188FFDBB' }, [PIXEL]),
    ).toEqual({})
    expect(keepChosen({ android: 'X1' }, [PIXEL, OFFLINE])).toEqual({})
  })

  it('keeps each selection while the page has no device list', () => {
    const chosen = { android: 'emulator-5556' }

    expect(keepChosen(chosen, undefined)).toBe(chosen)
  })
})

describe('rowInstall', () => {
  it('installs on the target of the build platform at once', () => {
    const devices = [PIXEL, TABLET, IPHONE]
    const targets = installTargets(devices, { android: 'emulator-5556' })

    expect(rowInstall(build('a'), targets, devices)).toEqual({
      kind: 'one',
      device: TABLET,
    })
    expect(rowInstall(IOS_BUILD, targets, devices)).toEqual({
      kind: 'one',
      device: IPHONE,
    })
  })

  it('opens the device menu when the platform has no target', () => {
    const devices = [PIXEL, TABLET]

    expect(
      rowInstall(build('a'), installTargets(devices, {}), devices),
    ).toEqual({ kind: 'many', devices: [PIXEL, TABLET] })
  })

  it('has no device when none of the platform is ready', () => {
    const devices = [PIXEL]

    expect(rowInstall(IOS_BUILD, installTargets(devices, {}), devices)).toEqual(
      { kind: 'no-device' },
    )
  })

  it('keeps a refused build refused, also with a target', () => {
    const devices = [PIXEL]
    const aab = {
      ...build('a'),
      installProblem: 'This build is an Android App Bundle (app.aab).',
    }

    expect(rowInstall(aab, installTargets(devices, {}), devices)).toEqual({
      kind: 'refused',
      reason: 'This build is an Android App Bundle (app.aab).',
    })
  })
})

describe('pickerView', () => {
  it('is off with the no-device text when no device runs', () => {
    expect(pickerView([], {})).toEqual({ kind: 'no-device', reason: NO_DEVICE })
    expect(pickerView(undefined, {})).toEqual({
      kind: 'no-device',
      reason: NO_DEVICE,
    })
  })

  it('names the target of each platform, Android first', () => {
    const devices = [IPHONE, PIXEL, TABLET]
    const view = pickerView(
      devices,
      installTargets(devices, { android: 'emulator-5554' }),
    )

    expect(view).toMatchObject({
      kind: 'devices',
      targets: [PIXEL, IPHONE],
      accessibilityLabel: 'Install on Pixel 8 and iPhone 16. Select a device',
    })
  })

  it('asks for a selection when no platform has a target', () => {
    const devices = [PIXEL, TABLET]

    expect(pickerView(devices, installTargets(devices, {}))).toMatchObject({
      targets: [],
      accessibilityLabel: 'Select a device for Install',
    })
  })

  it('lists the devices by platform, with each target and each state', () => {
    const devices = [IPHONE, PIXEL, OFFLINE, PHONE]
    const view = pickerView(
      devices,
      installTargets(devices, { android: 'R58M' }),
    )

    expect(view.kind === 'devices' ? view.groups : []).toEqual([
      {
        platform: 'android',
        items: [
          { device: PIXEL, label: 'Pixel 8', target: false },
          { device: OFFLINE, label: 'X1', target: false, state: 'offline' },
          { device: PHONE, label: 'Nokia C32', target: true },
        ],
      },
      {
        platform: 'ios',
        items: [
          { device: IPHONE, label: 'iPhone 16 (iOS 18.6)', target: true },
        ],
      },
    ])
  })

  it('shows a list of devices that are not ready, with no target', () => {
    const view = pickerView([OFFLINE], installTargets([OFFLINE], {}))

    expect(view).toMatchObject({
      kind: 'devices',
      targets: [],
      groups: [{ platform: 'android', items: [{ state: 'offline' }] }],
    })
  })
})

describe('installOnLabel', () => {
  it('names the build and the device', () => {
    expect(installOnLabel('a1b2c3d4', PIXEL)).toBe(
      'Install the build a1b2c3d4 on Pixel 8',
    )
    expect(installOnLabel('a1b2c3d4', IPHONE)).toBe(
      'Install the build a1b2c3d4 on iPhone 16 (iOS 18.6)',
    )
  })
})
