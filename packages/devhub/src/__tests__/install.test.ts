import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  adbDevice,
  adbInstallCommand,
  adbUninstallCommand,
} from '../devices/android'
import { DeviceError, type Device } from '../devices/device'
import { adbInstallFailure } from '../install/adb-failure'
import {
  installBuild,
  installPlatform,
  installProblem,
} from '../install/install'
import { EAS_RECORD_SCHEMA_VERSION, type StoredBuild } from '../store/builds'
import {
  NOW,
  easBuild,
  fakeDeviceTools,
  localBuild,
  useTempDir,
} from './helpers'

const EMULATOR = adbDevice({
  serial: 'emulator-5554',
  state: 'device',
  fields: {},
})

function storedBuild(
  file = 'app.apk',
  eas = easBuild({ id: 'aaaa1111-0000-4000-8000-000000000001' }),
): StoredBuild {
  return {
    id: eas.id,
    path: `/store/builds/${eas.id}/${file}`,
    record: {
      schemaVersion: EAS_RECORD_SCHEMA_VERSION,
      storedAt: NOW.toISOString(),
      file,
      size: 6,
      sha256: '0'.repeat(64),
      eas,
    },
  }
}

describe('adbInstallCommand', () => {
  it('keeps a path with a space as one argument', () => {
    expect(
      adbInstallCommand('adb', 'emulator-5554', '/My Store/app.apk'),
    ).toEqual([
      'adb',
      '-s',
      'emulator-5554',
      'install',
      '-r',
      '-d',
      '/My Store/app.apk',
    ])
  })
})

describe('adbUninstallCommand', () => {
  it('returns the uninstall command for one device', () => {
    expect(
      adbUninstallCommand('adb', 'R58M12ABCDE', 'com.example.app'),
    ).toEqual(['adb', '-s', 'R58M12ABCDE', 'uninstall', 'com.example.app'])
  })
})

describe('adbInstallFailure', () => {
  const target = {
    adb: 'adb',
    serial: 'R58M12ABCDE',
    apk: '/store/builds/aaaa/app.apk',
    appId: 'com.example.app',
  }

  function failure(stderr: string, code = 1, stdout = '') {
    return adbInstallFailure({ code, stdout, stderr }, target)
  }

  it('accepts a success', () => {
    expect(
      adbInstallFailure(
        {
          code: 0,
          stdout: 'Performing Streamed Install\nSuccess\n',
          stderr: '',
        },
        target,
      ),
    ).toBeUndefined()
  })

  it('gives the uninstall command for a different signing key', () => {
    expect(
      failure(
        'adb: failed to install /store/app.apk: Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE: Package com.example.app signatures do not match previously installed version; ignoring!]',
      ),
    ).toBe(
      [
        '"adb install" failed with INSTALL_FAILED_UPDATE_INCOMPATIBLE. The installed app has a different signing key. To install this build, uninstall the app first. The uninstall deletes the app data on the device:',
        '  adb -s R58M12ABCDE uninstall com.example.app',
        'Then run the command again.',
      ].join('\n'),
    )
  })

  it('gives the uninstall command for a downgrade that the device refuses', () => {
    const message = failure(
      'adb: failed to install /store/app.apk: Failure [INSTALL_FAILED_VERSION_DOWNGRADE: Downgrade detected: Update version code 1 is older than current 2]',
    )

    expect(message).toMatch(
      /^"adb install" failed with INSTALL_FAILED_VERSION_DOWNGRADE\. The installed app is newer, and the device does not allow a downgrade\./,
    )
    expect(message).toContain('  adb -s R58M12ABCDE uninstall com.example.app')
  })

  it('reads the app ID from the adb output when the record has none', () => {
    expect(
      adbInstallFailure(
        {
          code: 1,
          stdout: '',
          stderr:
            'Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE: Existing package com.other.app signatures do not match newer version; ignoring!]',
        },
        { ...target, appId: undefined },
      ),
    ).toContain('  adb -s R58M12ABCDE uninstall com.other.app\n')
  })

  it('gives a placeholder when it cannot find the app ID', () => {
    expect(
      adbInstallFailure(
        {
          code: 1,
          stdout: '',
          stderr: 'Failure [INSTALL_FAILED_VERSION_DOWNGRADE]',
        },
        { ...target, appId: undefined },
      ),
    ).toContain('  adb -s R58M12ABCDE uninstall <app ID>\n')
  })

  it('quotes an adb path with a space in the uninstall command', () => {
    expect(
      adbInstallFailure(
        {
          code: 1,
          stdout: '',
          stderr: 'Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE]',
        },
        { ...target, adb: '/My SDK/platform-tools/adb' },
      ),
    ).toContain(
      '  "/My SDK/platform-tools/adb" -s R58M12ABCDE uninstall com.example.app\n',
    )
  })

  it.each([
    [
      'Failure [INSTALL_FAILED_NO_MATCHING_ABIS: INSTALL_FAILED_NO_MATCHING_ABIS: Failed to extract native libraries, res=-113]',
      'INSTALL_FAILED_NO_MATCHING_ABIS. The build has no native code for the CPU architecture of the device.',
    ],
    [
      'Failure [INSTALL_FAILED_OLDER_SDK: Failed parse during installPackageLI: Requires newer sdk version #34 (current version is #30)]',
      'INSTALL_FAILED_OLDER_SDK. The Android version of the device is older than the minimum Android version of the build.',
    ],
    [
      'Failure [INSTALL_FAILED_INSUFFICIENT_STORAGE]',
      'INSTALL_FAILED_INSUFFICIENT_STORAGE. The device does not have sufficient free space.',
    ],
    [
      'Failure [INSTALL_FAILED_USER_RESTRICTED: Install canceled by user]',
      'INSTALL_FAILED_USER_RESTRICTED. The device did not accept the install.',
    ],
    [
      'Failure [INSTALL_FAILED_ABORTED: User rejected permissions]',
      'INSTALL_FAILED_ABORTED. The device did not accept the install.',
    ],
    [
      'Failure [INSTALL_PARSE_FAILED_NO_CERTIFICATES: Failed to collect certificates from /data/app/vmdl.tmp/base.apk]',
      'INSTALL_PARSE_FAILED_NO_CERTIFICATES. The device cannot read the file. The stored file can be damaged. Delete the folder /store/builds/aaaa,',
    ],
    [
      'Failure [INSTALL_FAILED_INVALID_APK: Split lib_slice was defined multiple times]',
      'INSTALL_FAILED_INVALID_APK. The device cannot read the file.',
    ],
  ])('gives the cause and the fix for %s', (stderr, reason) => {
    expect(
      failure(`adb: failed to install /store/app.apk: ${stderr}`),
    ).toContain(`"adb install" failed with ${reason}`)
  })

  it.each([
    "adb: failed to install /store/app.apk: cmd: Can't find service: package",
    'Error: Could not access the Package Manager.  Is the system running?',
  ])('reports a device that has not finished its start: %s', (stderr) => {
    expect(failure(stderr)).toBe(
      '"adb install" failed, because the device has not finished its start. Wait until the device shows its home screen, and then run the command again.',
    )
  })

  it('reads a failure that an old adb prints with exit code 0', () => {
    expect(failure('', 0, 'Failure [INSTALL_FAILED_OLDER_SDK]\n')).toMatch(
      /^"adb install" failed with INSTALL_FAILED_OLDER_SDK\. /,
    )
  })

  it('gives the end of the adb output for an unknown code', () => {
    expect(
      failure(
        'adb: failed to install /store/app.apk: Failure [INSTALL_FAILED_DUPLICATE_PERMISSION: Package com.example.app attempting to redeclare permission]',
        1,
        'Performing Streamed Install\n',
      ),
    ).toMatch(
      /^"adb install" failed with exit code 1\.\nPerforming Streamed Install\nadb: failed to install .*INSTALL_FAILED_DUPLICATE_PERMISSION/,
    )
  })

  it('gives the end of the adb output for a failure with no code', () => {
    expect(failure("adb: device 'R58M12ABCDE' not found", 1)).toBe(
      `"adb install" failed with exit code 1.\nadb: device 'R58M12ABCDE' not found`,
    )
  })

  it('reads an unknown failure that an old adb prints with exit code 0', () => {
    expect(failure('', 0, 'Failure [UNKNOWN_REASON]\n')).toBe(
      '"adb install" failed with exit code 0.\nFailure [UNKNOWN_REASON]',
    )
  })
})

function storedLocalBuild(file: string, local = localBuild()): StoredBuild {
  const id = 'bbbb2222-0000-4000-8000-000000000002'
  return {
    id,
    path: `/store/builds/${id}/${file}`,
    record: {
      schemaVersion: 2,
      source: 'local',
      storedAt: NOW.toISOString(),
      file,
      size: 6,
      sha256: '0'.repeat(64),
      local,
    },
  }
}

describe('installProblem of a local build', () => {
  const ios = localBuild({ platform: 'IOS', variant: 'Debug' })

  it('accepts a local APK, and a local iOS build on macOS only', () => {
    expect(installProblem(storedLocalBuild('app.apk'), 'linux')).toBeUndefined()
    expect(
      installProblem(storedLocalBuild('app.tar.gz', ios), 'darwin'),
    ).toBeUndefined()
    expect(
      installProblem(storedLocalBuild('app.tar.gz', ios), 'win32'),
    ).toContain('iOS simulators run only on macOS')
    expect(installPlatform(storedLocalBuild('app.tar.gz', ios))).toBe('ios')
  })

  it('gives the uninstall command with the app ID of the local record', async () => {
    const tools = fakeDeviceTools({
      install: {
        code: 1,
        stdout: '',
        stderr:
          'adb: failed to install app.apk: Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE: signatures do not match]',
      },
    })

    await expect(
      installBuild(storedLocalBuild('app.apk'), EMULATOR, {
        run: tools.run,
        adb: 'adb',
        cwd: '/',
        platform: 'linux',
        home: '/store',
      }),
    ).rejects.toThrow('adb -s emulator-5554 uninstall com.example.myapp')
  })
})

describe('installProblem', () => {
  const ios = easBuild({ platform: 'IOS', buildProfile: 'preview' })
  const simulator = easBuild({ platform: 'IOS', isForIosSimulator: true })

  it.each(['darwin', 'linux', 'win32'] as const)(
    'accepts an Android .apk on %s',
    (platform) => {
      expect(installProblem(storedBuild('app.APK'), platform)).toBeUndefined()
    },
  )

  it('refuses an .aab, with the eas.json fix for its profile', () => {
    const build = storedBuild('app.aab')

    expect(installProblem(build, 'linux')).toBe(
      `The build ${build.id} is an Android App Bundle (app.aab). adb installs only an APK. Set "android": { "buildType": "apk" } in the build profile "development" in eas.json, and make a new build.`,
    )
  })

  it('refuses an iOS device build on macOS, with the eas.json fix', () => {
    expect(installProblem(storedBuild('app.ipa', ios), 'darwin')).toBe(
      `The build ${ios.id} is an iOS device build (app.ipa). A simulator cannot run it. Set "ios": { "simulator": true } in the build profile "preview" in eas.json, and make a new build.`,
    )
  })

  it('names no profile when the record has none', () => {
    const { buildProfile: _, ...eas } = easBuild()

    expect(installProblem(storedBuild('app.aab', eas), 'darwin')).toContain(
      'in the build profile in eas.json',
    )
  })

  it.each([
    ['linux', 'an iOS device build', 'app.ipa', ios],
    ['win32', 'an iOS device build', 'app.ipa', ios],
    ['linux', 'an iOS simulator build', 'app.tar.gz', simulator],
    ['win32', 'an iOS simulator build', 'app.tar.gz', simulator],
  ] as const)(
    'refuses on %s %s, because it is not macOS',
    (platform, _label, file, eas) => {
      expect(installProblem(storedBuild(file, eas), platform)).toBe(
        `The build ${eas.id} is an iOS build. iOS simulators run only on macOS, so DevHub installs an iOS build only on macOS.`,
      )
    },
  )

  it.each([
    ['with the simulator flag', 'app.tgz', simulator],
    [
      'with no simulator flag and a .tar.gz file',
      'app.tar.gz',
      easBuild({ platform: 'IOS' }),
    ],
  ])('accepts an iOS simulator build on macOS %s', (_label, file, eas) => {
    expect(installProblem(storedBuild(file, eas), 'darwin')).toBeUndefined()
  })

  it.each([
    ['an Android file that is not an .apk or an .aab', 'app.zip', easBuild()],
    [
      'an iOS file that is not a simulator archive',
      'app.zip',
      easBuild({ platform: 'IOS' }),
    ],
    [
      'a build of an unknown platform',
      'app.bin',
      easBuild({ platform: 'WEB' }),
    ],
  ])('refuses %s', (_label, file, eas) => {
    expect(installProblem(storedBuild(file, eas), 'darwin')).toBe(
      `DevHub cannot install the build ${eas.id}. Its file ${file} is not an Android .apk or an iOS simulator build.`,
    )
  })
})

describe('installPlatform', () => {
  it.each([
    ['ANDROID', 'android'],
    ['IOS', 'ios'],
  ])('gives the device platform of an %s build', (platform, expected) => {
    expect(installPlatform(storedBuild('app', easBuild({ platform })))).toBe(
      expected,
    )
  })
})

describe('installBuild', () => {
  const options = {
    adb: 'adb',
    cwd: '/',
    platform: 'linux',
    home: '/devhub',
  } as const

  it('runs adb install on the device with the stored file', async () => {
    const tools = fakeDeviceTools()
    const build = storedBuild()

    await installBuild(build, EMULATOR, { ...options, run: tools.run })

    expect(tools.calls).toEqual([
      ['adb', '-s', 'emulator-5554', 'install', '-r', '-d', build.path],
    ])
  })

  it('throws the failure of adb install', async () => {
    const tools = fakeDeviceTools({
      install: {
        code: 1,
        stdout: '',
        stderr: 'adb: failed to install: Failure [INSTALL_FAILED_OLDER_SDK]',
      },
    })

    await expect(
      installBuild(storedBuild(), EMULATOR, { ...options, run: tools.run }),
    ).rejects.toThrow(DeviceError)
  })

  it('gives the uninstall command with the app ID of the record', async () => {
    const tools = fakeDeviceTools({
      install: {
        code: 1,
        stdout: '',
        stderr: 'Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE]',
      },
    })
    const build = storedBuild(
      'app.apk',
      easBuild({ appIdentifier: 'com.example.dev' }),
    )

    await expect(
      installBuild(build, EMULATOR, { ...options, run: tools.run }),
    ).rejects.toThrow('  adb -s emulator-5554 uninstall com.example.dev\n')
  })

  it('runs nothing for a build that it cannot install', async () => {
    const tools = fakeDeviceTools()

    await expect(
      installBuild(storedBuild('app.aab'), EMULATOR, {
        ...options,
        run: tools.run,
      }),
    ).rejects.toThrow('adb installs only an APK')
    expect(tools.calls).toEqual([])
  })

  it('runs nothing on a device that is not ready', async () => {
    const tools = fakeDeviceTools()
    const phone = adbDevice({
      serial: 'R58M12ABCDE',
      state: 'unauthorized',
      fields: {},
    })

    await expect(
      installBuild(storedBuild(), phone, { ...options, run: tools.run }),
    ).rejects.toThrow('is not a ready Android device')
    expect(tools.calls).toEqual([])
  })
})

describe('installBuild for an iOS simulator build', () => {
  const tempDir = useTempDir()
  const SIMULATOR: Device = {
    platform: 'ios',
    kind: 'simulator',
    id: 'AAAA-1111',
    name: 'iPhone 16',
    state: 'Booted',
    ready: true,
    osVersion: '18.6',
  }

  async function setup(tools = fakeDeviceTools()) {
    const home = await tempDir()
    const build = storedBuild(
      'app.tar.gz',
      easBuild({ platform: 'IOS', isForIosSimulator: true }),
    )
    const options = { run: tools.run, adb: 'adb', cwd: home, home }
    return {
      home,
      build,
      tools,
      options: { ...options, platform: 'darwin' as const },
    }
  }

  it('unpacks the build, and runs simctl install with the .app', async () => {
    const { home, build, tools, options } = await setup()

    await installBuild(build, SIMULATOR, options)

    expect(tools.calls.map((command) => command[0])).toEqual(['tar', 'xcrun'])
    expect(tools.calls.at(-1)).toEqual([
      'xcrun',
      'simctl',
      'install',
      'AAAA-1111',
      path.join(home, 'extracted', build.id, 'My App.app'),
    ])
  })

  it('throws the failure of simctl install', async () => {
    const { build, options } = await setup(
      fakeDeviceTools({
        simctlInstall: {
          code: 149,
          stdout: '',
          stderr: 'An error was encountered processing the command',
        },
      }),
    )

    await expect(installBuild(build, SIMULATOR, options)).rejects.toThrow(
      '"xcrun simctl install" failed with exit code 149.\nAn error was encountered processing the command',
    )
  })

  it('runs nothing on an Android device', async () => {
    const { build, tools, options } = await setup()

    await expect(installBuild(build, EMULATOR, options)).rejects.toThrow(
      'The device emulator-5554 is not a booted iOS simulator.',
    )
    expect(tools.calls).toEqual([])
  })

  it('runs nothing on a system that is not macOS', async () => {
    const { build, tools, options } = await setup()

    await expect(
      installBuild(build, SIMULATOR, { ...options, platform: 'linux' }),
    ).rejects.toThrow('iOS simulators run only on macOS')
    expect(tools.calls).toEqual([])
  })
})
