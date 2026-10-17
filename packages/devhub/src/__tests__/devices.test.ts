import { describe, expect, it } from 'vitest'
import {
  ADB_MISSING,
  adbAvdNameCommand,
  adbDevice,
  adbDevicesCommand,
  parseAdbDevices,
  parseAvdName,
  resolveAdb,
} from '../devices/android'
import { listDevices } from '../devices/list'
import { fakeAdb } from './helpers'

const ADB_OUTPUT = [
  '* daemon not running; starting now at tcp:5037',
  '* daemon started successfully',
  'List of devices attached',
  'emulator-5554          device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a transport_id:1',
  'R58M12ABCDE            unauthorized usb:1-1 transport_id:2',
  '0A1B2C3D               offline transport_id:3',
  'adb-R58M12ABCDE-x7Yz1a._adb-tls-connect._tcp device product:o1sxxx model:SM_G991B device:o1s transport_id:4',
  'ABCDEF012345           no permissions (missing udev rules? user is in the plugdev group); see [http://developer.android.com/tools/device.html] usb:1-2 transport_id:5',
  '',
].join('\r\n')

describe('resolveAdb', () => {
  const posix = { platform: 'darwin' as const, homedir: '/Users/me' }

  it('uses ANDROID_HOME first', () => {
    const exists = (file: string) =>
      file === '/sdk/home/platform-tools/adb' ||
      file === '/sdk/root/platform-tools/adb'

    expect(
      resolveAdb(
        {
          ...posix,
          env: { ANDROID_HOME: '/sdk/home', ANDROID_SDK_ROOT: '/sdk/root' },
        },
        exists,
      ),
    ).toBe('/sdk/home/platform-tools/adb')
  })

  it('goes to ANDROID_SDK_ROOT when ANDROID_HOME has no adb', () => {
    const exists = (file: string) => file === '/sdk/root/platform-tools/adb'

    expect(
      resolveAdb(
        {
          ...posix,
          env: { ANDROID_HOME: '/sdk/empty', ANDROID_SDK_ROOT: '/sdk/root' },
        },
        exists,
      ),
    ).toBe('/sdk/root/platform-tools/adb')
  })

  it.each([
    [
      'darwin',
      '/Users/me',
      {},
      '/Users/me/Library/Android/sdk/platform-tools/adb',
    ],
    ['linux', '/home/me', {}, '/home/me/Android/Sdk/platform-tools/adb'],
    [
      'win32',
      'C:\\Users\\me',
      { LOCALAPPDATA: 'D:\\Local' },
      'D:\\Local\\Android\\Sdk\\platform-tools\\adb.exe',
    ],
    [
      'win32',
      'C:\\Users\\me',
      {},
      'C:\\Users\\me\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe',
    ],
  ] as const)(
    'uses the default SDK folder on %s',
    (platform, homedir, env, expected) => {
      const exists = (file: string) => file === expected

      expect(resolveAdb({ platform, homedir, env }, exists)).toBe(expected)
    },
  )

  it('falls back to adb on PATH', () => {
    expect(
      resolveAdb({ ...posix, env: { ANDROID_HOME: '/sdk' } }, () => false),
    ).toBe('adb')
  })
})

describe('adbDevicesCommand', () => {
  it('asks for the long list', () => {
    expect(adbDevicesCommand('/sdk/platform-tools/adb')).toEqual([
      '/sdk/platform-tools/adb',
      'devices',
      '-l',
    ])
  })
})

describe('adbAvdNameCommand', () => {
  it('asks the emulator console for the AVD name', () => {
    expect(adbAvdNameCommand('adb', 'emulator-5554')).toEqual([
      'adb',
      '-s',
      'emulator-5554',
      'emu',
      'avd',
      'name',
    ])
  })
})

describe('parseAvdName', () => {
  it.each([
    ['Pixel_8_API_35\r\nOK\r\n', 'Pixel_8_API_35'],
    ['\nMedium Phone API 36\nOK\n', 'Medium Phone API 36'],
    ['OK\n', undefined],
    ['KO: unknown command\n', undefined],
    ['', undefined],
  ])('reads %j as %j', (stdout, name) => {
    expect(parseAvdName(stdout)).toBe(name)
  })
})

describe('parseAdbDevices', () => {
  it('reads each device line, and skips the daemon lines and the title', () => {
    expect(
      parseAdbDevices(ADB_OUTPUT).map(({ serial, state }) => [serial, state]),
    ).toEqual([
      ['emulator-5554', 'device'],
      ['R58M12ABCDE', 'unauthorized'],
      ['0A1B2C3D', 'offline'],
      ['adb-R58M12ABCDE-x7Yz1a._adb-tls-connect._tcp', 'device'],
      ['ABCDEF012345', 'no permissions'],
    ])
  })

  it('reads the key:value fields', () => {
    expect(parseAdbDevices(ADB_OUTPUT)[0]?.fields).toEqual({
      product: 'sdk_gphone64_arm64',
      model: 'sdk_gphone64_arm64',
      device: 'emu64a',
      transport_id: '1',
    })
  })

  it('returns no device for an empty list', () => {
    expect(parseAdbDevices('List of devices attached\n\n')).toEqual([])
  })
})

describe('adbDevice', () => {
  const devices = parseAdbDevices(ADB_OUTPUT).map((entry) => adbDevice(entry))

  it('tells an emulator from a physical device', () => {
    expect(devices.map((device) => device.kind)).toEqual([
      'emulator',
      'physical',
      'physical',
      'physical',
      'physical',
    ])
  })

  it('names a device by its model, or else by its serial', () => {
    expect(devices[0]?.name).toBe('sdk gphone64 arm64')
    expect(devices[1]?.name).toBe('R58M12ABCDE')
    expect(devices[3]?.name).toBe('SM G991B')
  })

  it('names an emulator by its AVD name when it has one', () => {
    const entry = parseAdbDevices(ADB_OUTPUT)[0]

    expect(entry && adbDevice(entry, 'Pixel_8_API_35').name).toBe(
      'Pixel_8_API_35',
    )
  })

  it('is ready only in the state "device"', () => {
    expect(devices.map((device) => device.ready)).toEqual([
      true,
      false,
      false,
      true,
      false,
    ])
    expect(devices[0]).not.toHaveProperty('problem')
  })

  it.each([
    ['unauthorized', 'accept the USB debugging prompt'],
    ['authorizing', 'Wait, and run the command again'],
    ['offline', 'Connect the device again, or restart the emulator'],
    ['no permissions', 'add a udev rule'],
    ['recovery', 'is in the "recovery" mode'],
  ])('gives the fix for the state %s', (state, fix) => {
    const device = adbDevice({ serial: 'X1', state, fields: {} })

    expect(device.ready).toBe(false)
    expect(device.problem).toContain(fix)
  })
})

describe('listDevices', () => {
  const options = {
    env: {},
    platform: 'linux' as const,
    homedir: '/nowhere',
    cwd: '/',
  }

  it('lists the adb devices', async () => {
    const adb = fakeAdb({ devices: ADB_OUTPUT })

    const list = await listDevices({ ...options, run: adb.run })

    expect(list.devices.map((device) => device.id)).toHaveLength(5)
    expect(list.sources).toEqual([{ platform: 'android' }])
    expect(adb.calls[0]).toEqual(['adb', 'devices', '-l'])
  })

  it('reads the AVD name of each ready emulator, and of no other device', async () => {
    const adb = fakeAdb({
      devices: [
        'List of devices attached',
        'emulator-5554  device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64',
        'emulator-5556  offline',
        'R58M12ABCDE    device model:SM_G991B',
        '',
      ].join('\n'),
      avdNames: { 'emulator-5554': 'Pixel_8_API_35' },
    })

    const list = await listDevices({ ...options, run: adb.run })

    expect(list.devices.map((device) => device.name)).toEqual([
      'Pixel_8_API_35',
      'emulator-5556',
      'SM G991B',
    ])
    expect(adb.calls.slice(1)).toEqual([
      adbAvdNameCommand('adb', 'emulator-5554'),
    ])
  })

  it('keeps the model name when the emulator console does not answer', async () => {
    const adb = fakeAdb({ devices: ADB_OUTPUT })

    const list = await listDevices({ ...options, run: adb.run })

    expect(list.devices[0]?.name).toBe('sdk gphone64 arm64')
    expect(list.sources).toEqual([{ platform: 'android' }])
  })

  it('gives the install fix when adb is missing', async () => {
    const list = await listDevices({
      ...options,
      run: fakeAdb({ missing: true }).run,
    })

    expect(list.devices).toEqual([])
    expect(list.sources).toEqual([{ platform: 'android', error: ADB_MISSING }])
  })

  it('reports a failed adb with the end of its stderr', async () => {
    const run = fakeAdb({
      failure: { code: 1, stderr: 'error: protocol fault' },
    }).run

    const list = await listDevices({ ...options, run })

    expect(list.sources[0]?.error).toMatch(
      /"adb devices" failed with exit code 1\.\nerror: protocol fault/,
    )
  })
})
