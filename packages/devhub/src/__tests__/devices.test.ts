import { describe, expect, it } from 'vitest'
import type { Device } from '../devices/device'
import {
  ADB_MISSING,
  adbAvdNameCommand,
  adbDevice,
  adbDevicesCommand,
  parseAdbDevices,
  parseAvdName,
  resolveAdb,
} from '../devices/android'
import {
  XCRUN_MISSING,
  iosRuntimeVersion,
  parseSimctlDevices,
  simctlInstallCommand,
  simctlListCommand,
} from '../devices/ios'
import { listDevices } from '../devices/list'
import { findDevice, selectDevice } from '../devices/select'
import { fakeDeviceTools } from './helpers'

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
    const adb = fakeDeviceTools({ devices: ADB_OUTPUT })

    const list = await listDevices({ ...options, run: adb.run })

    expect(list.devices.map((device) => device.id)).toHaveLength(5)
    expect(list.sources).toEqual([{ platform: 'android' }])
    expect(adb.calls[0]).toEqual(['adb', 'devices', '-l'])
  })

  it('reads the AVD name of each ready emulator, and of no other device', async () => {
    const adb = fakeDeviceTools({
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
    const adb = fakeDeviceTools({ devices: ADB_OUTPUT })

    const list = await listDevices({ ...options, run: adb.run })

    expect(list.devices[0]?.name).toBe('sdk gphone64 arm64')
    expect(list.sources).toEqual([{ platform: 'android' }])
  })

  it('gives the install fix when adb is missing', async () => {
    const list = await listDevices({
      ...options,
      run: fakeDeviceTools({ adbMissing: true }).run,
    })

    expect(list.devices).toEqual([])
    expect(list.sources).toEqual([{ platform: 'android', error: ADB_MISSING }])
  })

  it('reports a failed adb with the end of its stderr', async () => {
    const run = fakeDeviceTools({
      adbFailure: { code: 1, stderr: 'error: protocol fault' },
    }).run

    const list = await listDevices({ ...options, run })

    expect(list.sources[0]?.error).toMatch(
      /"adb devices" failed with exit code 1\.\nerror: protocol fault/,
    )
  })
})

const SIMCTL_LIST = {
  devices: {
    'com.apple.CoreSimulator.SimRuntime.iOS-18-6': [
      {
        udid: '188FFDBB-80E1-4C86-A9AC-95A4586ACA33',
        name: 'iPhone 16 Pro',
        state: 'Booted',
        isAvailable: true,
        deviceTypeIdentifier:
          'com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro',
      },
      { udid: 'SHUTDOWN-1', name: 'iPhone 16', state: 'Shutdown' },
      {
        udid: 'UNAVAILABLE-1',
        name: 'iPhone 15',
        state: 'Booted',
        isAvailable: false,
      },
      { name: 'No UDID', state: 'Booted' },
    ],
    'com.apple.CoreSimulator.SimRuntime.iOS-26-0': [
      { udid: 'IPAD-1', name: 'iPad Air', state: 'Booted' },
    ],
    'com.apple.CoreSimulator.SimRuntime.tvOS-18-4': [
      { udid: 'TV-1', name: 'Apple TV', state: 'Booted' },
    ],
    'com.apple.CoreSimulator.SimRuntime.watchOS-11-4': [
      { udid: 'WATCH-1', name: 'Apple Watch', state: 'Booted' },
    ],
    'com.apple.CoreSimulator.SimRuntime.xrOS-2-4': [
      { udid: 'VISION-1', name: 'Apple Vision Pro', state: 'Booted' },
    ],
  },
}

describe('simctlInstallCommand', () => {
  it('keeps an app path with a space as one argument', () => {
    expect(simctlInstallCommand('AAAA-1111', '/My Store/My App.app')).toEqual([
      'xcrun',
      'simctl',
      'install',
      'AAAA-1111',
      '/My Store/My App.app',
    ])
  })
})

describe('simctlListCommand', () => {
  it('asks for every simulator as JSON', () => {
    expect(simctlListCommand()).toEqual([
      'xcrun',
      'simctl',
      'list',
      'devices',
      '--json',
    ])
  })
})

describe('iosRuntimeVersion', () => {
  it.each([
    ['com.apple.CoreSimulator.SimRuntime.iOS-18-6', '18.6'],
    ['com.apple.CoreSimulator.SimRuntime.iOS-26-0', '26.0'],
    ['com.apple.CoreSimulator.SimRuntime.iOS-17-0-1', '17.0.1'],
    ['iOS 12.1', '12.1'],
    ['com.apple.CoreSimulator.SimRuntime.tvOS-18-4', undefined],
    ['com.apple.CoreSimulator.SimRuntime.watchOS-11-4', undefined],
    ['com.apple.CoreSimulator.SimRuntime.xrOS-2-4', undefined],
    ['tvOS 12.1', undefined],
  ])('reads %s as %s', (runtime, version) => {
    expect(iosRuntimeVersion(runtime)).toBe(version)
  })
})

describe('parseSimctlDevices', () => {
  it('keeps only the booted iOS simulators that are available', () => {
    expect(parseSimctlDevices(JSON.stringify(SIMCTL_LIST))).toEqual([
      {
        platform: 'ios',
        kind: 'simulator',
        id: '188FFDBB-80E1-4C86-A9AC-95A4586ACA33',
        name: 'iPhone 16 Pro',
        state: 'Booted',
        ready: true,
        osVersion: '18.6',
      },
      {
        platform: 'ios',
        kind: 'simulator',
        id: 'IPAD-1',
        name: 'iPad Air',
        state: 'Booted',
        ready: true,
        osVersion: '26.0',
      },
    ])
  })

  it.each([['not json'], ['[]'], ['{"devices": []}']])(
    'rejects the output %j',
    (stdout) => {
      expect(() => parseSimctlDevices(stdout)).toThrow(
        /"xcrun simctl list" printed output that DevHub cannot read/,
      )
    },
  )
})

describe('listDevices on macOS', () => {
  const options = {
    env: {},
    platform: 'darwin' as const,
    homedir: '/nowhere',
    cwd: '/',
  }

  it('lists the adb devices and then the booted simulators', async () => {
    const tools = fakeDeviceTools({
      devices: 'List of devices attached\nemulator-5554  device\n',
      simulators: SIMCTL_LIST,
    })

    const list = await listDevices({ ...options, run: tools.run })

    expect(list.devices.map((device) => device.id)).toEqual([
      'emulator-5554',
      '188FFDBB-80E1-4C86-A9AC-95A4586ACA33',
      'IPAD-1',
    ])
    expect(list.sources).toEqual([{ platform: 'android' }, { platform: 'ios' }])
  })

  it('keeps the simulators when adb is missing', async () => {
    const tools = fakeDeviceTools({ adbMissing: true, simulators: SIMCTL_LIST })

    const list = await listDevices({ ...options, run: tools.run })

    expect(list.devices).toHaveLength(2)
    expect(list.sources).toEqual([
      { platform: 'android', error: ADB_MISSING },
      { platform: 'ios' },
    ])
  })

  it('gives the Xcode fix when xcrun is missing', async () => {
    const tools = fakeDeviceTools({ xcrunMissing: true })

    const list = await listDevices({ ...options, run: tools.run })

    expect(list.sources[1]).toEqual({ platform: 'ios', error: XCRUN_MISSING })
  })

  it('gives the xcode-select fix when simctl fails', async () => {
    const tools = fakeDeviceTools({
      simctlFailure: {
        code: 72,
        stderr:
          'xcrun: error: unable to find utility "simctl", not a developer tool or in PATH',
      },
    })

    const list = await listDevices({ ...options, run: tools.run })

    expect(list.sources[1]?.error).toMatch(
      /^"xcrun simctl list" failed with exit code 72\. Install Xcode, and select it with "sudo xcode-select --switch \/Applications\/Xcode\.app"\.\nxcrun: error: unable to find utility "simctl"/,
    )
  })

  it('does not run xcrun on Linux or Windows', async () => {
    for (const platform of ['linux', 'win32'] as const) {
      const tools = fakeDeviceTools()

      const list = await listDevices({ ...options, platform, run: tools.run })

      expect(list.sources).toEqual([{ platform: 'android' }])
      expect(tools.calls.map(([program]) => program)).not.toContain('xcrun')
    }
  })
})

describe('selectDevice', () => {
  const emulator = adbDevice(
    { serial: 'emulator-5554', state: 'device', fields: {} },
    'Pixel_Light_34',
  )
  const phone = adbDevice({
    serial: '4Z01Z3227Y353006313',
    state: 'device',
    fields: { model: 'Nokia_C32' },
  })
  const locked = adbDevice({
    serial: 'R58M12ABCDE',
    state: 'unauthorized',
    fields: {},
  })

  it('selects the one ready device', () => {
    expect(selectDevice([emulator, locked], 'android')).toEqual({
      kind: 'selected',
      device: emulator,
    })
  })

  it('asks for --device, as a usage error, when two devices are ready', () => {
    expect(selectDevice([emulator, phone, locked], 'android')).toEqual({
      kind: 'error',
      usage: true,
      message: [
        '2 devices are ready. Select one with --device <id>:',
        '  emulator-5554        Pixel_Light_34',
        '  4Z01Z3227Y353006313  Nokia C32',
      ].join('\n'),
    })
  })

  it('gives the reason of each device when no device is ready', () => {
    expect(selectDevice([locked], 'android')).toEqual({
      kind: 'error',
      usage: false,
      message: [
        'No Android emulator or device is ready:',
        '  R58M12ABCDE  Unlock the device, and accept the USB debugging prompt on it.',
      ].join('\n'),
    })
  })

  it.each([
    [
      'android',
      'No Android emulator or device runs now. Start an emulator, or connect a device with USB debugging on. Then run the command again.',
    ],
    [
      'ios',
      'No iOS simulator runs now. Boot a simulator, and then run the command again.',
    ],
  ] as const)(
    'says how to start a %s device when none runs',
    (platform, message) => {
      expect(selectDevice([], platform)).toEqual({
        kind: 'error',
        usage: false,
        message,
      })
    },
  )

  it('selects the device that --device names, with or without the same case', () => {
    expect(selectDevice([emulator, phone], 'android', phone.id)).toEqual({
      kind: 'selected',
      device: phone,
    })
    expect(selectDevice([emulator, phone], 'android', 'EMULATOR-5554')).toEqual(
      { kind: 'selected', device: emulator },
    )
  })

  it('stops when --device names no device, or a device that is not ready', () => {
    expect(selectDevice([emulator], 'android', 'emulator-9999')).toEqual({
      kind: 'error',
      usage: false,
      message:
        'No running Android emulator or device has the ID "emulator-9999". Run devhub devices to see the devices.',
    })
    expect(selectDevice([emulator, locked], 'android', 'R58M12ABCDE')).toEqual({
      kind: 'error',
      usage: false,
      message:
        'The device R58M12ABCDE is not ready. Unlock the device, and accept the USB debugging prompt on it.',
    })
  })

  it('finds a device by its ID, with or without the same case', () => {
    expect(findDevice([emulator, phone], phone.id)).toBe(phone)
    expect(findDevice([emulator, phone], 'EMULATOR-5554')).toBe(emulator)
    expect(findDevice([emulator, phone], 'emulator-9999')).toBeUndefined()
  })

  describe('with devices of both platforms', () => {
    const simulator: Device = {
      platform: 'ios',
      kind: 'simulator',
      id: 'AAAA-1111',
      name: 'iPhone 16',
      state: 'Booted',
      ready: true,
      osVersion: '18.6',
    }

    it('selects only from the devices of the platform', () => {
      expect(selectDevice([emulator, simulator], 'ios')).toEqual({
        kind: 'selected',
        device: simulator,
      })
      expect(selectDevice([emulator, simulator], 'android')).toEqual({
        kind: 'selected',
        device: emulator,
      })
    })

    it('says that no device of the platform runs', () => {
      expect(selectDevice([simulator], 'android')).toEqual({
        kind: 'error',
        usage: false,
        message:
          'No Android emulator or device runs now. Start an emulator, or connect a device with USB debugging on. Then run the command again.',
      })
    })

    it.each([
      [
        'android',
        'aaaa-1111',
        'The device AAAA-1111 is an iOS simulator, but the build is for an Android emulator or device.',
      ],
      [
        'ios',
        'emulator-5554',
        'The device emulator-5554 is an Android emulator or device, but the build is for an iOS simulator.',
      ],
    ] as const)(
      'stops when --device names a device of the other platform (%s)',
      (platform, wanted, message) => {
        expect(selectDevice([emulator, simulator], platform, wanted)).toEqual({
          kind: 'error',
          usage: false,
          message,
        })
      },
    )
  })
})
