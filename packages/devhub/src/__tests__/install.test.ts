import { describe, expect, it } from 'vitest'
import {
  adbDevice,
  adbInstallCommand,
  adbInstallFailure,
} from '../devices/android'
import { DeviceError } from '../devices/device'
import { installBuild, installProblem } from '../install/install'
import { BUILD_RECORD_SCHEMA_VERSION, type StoredBuild } from '../store/builds'
import { NOW, easBuild, fakeDeviceTools } from './helpers'

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
      schemaVersion: BUILD_RECORD_SCHEMA_VERSION,
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

describe('adbInstallFailure', () => {
  it('accepts a success', () => {
    expect(
      adbInstallFailure({
        code: 0,
        stdout: 'Performing Streamed Install\nSuccess\n',
        stderr: '',
      }),
    ).toBeUndefined()
  })

  it('reports a failure with the end of the adb output', () => {
    expect(
      adbInstallFailure({
        code: 1,
        stdout: 'Performing Streamed Install\n',
        stderr:
          'adb: failed to install /store/app.apk: Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE: Package com.example.app signatures do not match]\n',
      }),
    ).toMatch(
      /^"adb install" failed with exit code 1\.\nPerforming Streamed Install\nadb: failed to install .*INSTALL_FAILED_UPDATE_INCOMPATIBLE/,
    )
  })

  it('reports a failure that an old adb prints with exit code 0', () => {
    expect(
      adbInstallFailure({
        code: 0,
        stdout: 'Failure [INSTALL_FAILED_OLDER_SDK]\n',
        stderr: '',
      }),
    ).toMatch(/exit code 0\.\nFailure \[INSTALL_FAILED_OLDER_SDK\]$/)
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
    ['an iOS simulator build on macOS', 'app.tar.gz', simulator],
    ['an Android file that is not an .apk or an .aab', 'app.zip', easBuild()],
    [
      'a build of an unknown platform',
      'app.bin',
      easBuild({ platform: 'WEB' }),
    ],
  ])(
    'refuses %s, because DevHub cannot install it yet',
    (_label, file, eas) => {
      expect(installProblem(storedBuild(file, eas), 'darwin')).toBe(
        `DevHub can install only an Android .apk build now. The build ${eas.id} is the file ${file}.`,
      )
    },
  )
})

describe('installBuild', () => {
  const options = { adb: 'adb', cwd: '/', platform: 'linux' } as const

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
