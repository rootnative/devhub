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
  it('accepts an Android .apk', () => {
    expect(installProblem(storedBuild('app.APK'))).toBeUndefined()
  })

  it.each([
    ['an .aab', 'app.aab', easBuild()],
    [
      'an iOS simulator build',
      'app.tar.gz',
      easBuild({ platform: 'IOS', isForIosSimulator: true }),
    ],
    ['an iOS device build', 'app.ipa', easBuild({ platform: 'IOS' })],
  ])('refuses %s', (_label, file, eas) => {
    expect(installProblem(storedBuild(file, eas))).toBe(
      `DevHub can install only an Android .apk build now. The build ${eas.id} is the file ${file}.`,
    )
  })
})

describe('installBuild', () => {
  const options = { adb: 'adb', cwd: '/' }

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
    ).rejects.toThrow('only an Android .apk')
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
