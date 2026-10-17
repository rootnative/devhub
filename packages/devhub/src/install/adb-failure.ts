import path from 'node:path'
import {
  formatCommand,
  outputTail,
  type CommandResult,
} from '../command/run-command'
import { adbUninstallCommand } from '../devices/android'

export type AdbInstallTarget = {
  /** The adb program, from `resolveAdb`. */
  adb: string
  serial: string
  apk: string
  /** The app ID of the build, for the uninstall command. */
  appId?: string
}

const NOT_STARTED =
  /Can't find service: package|Could not access the Package Manager/

/**
 * Returns the reason that `adb install` failed, with the fix, or `undefined`
 * when it worked. An old adb exits with 0 after a failure, so the output
 * decides too. A code that DevHub does not know gives the end of the output.
 */
export function adbInstallFailure(
  result: CommandResult,
  target: AdbInstallTarget,
): string | undefined {
  const output = [result.stdout, result.stderr]
    .map((text) => text.trim())
    .filter((text) => text !== '')
    .join('\n')
  const code = /\b(INSTALL_(?:PARSE_)?FAILED_[A-Z0-9_]+)/.exec(output)?.[1]
  const notStarted = NOT_STARTED.test(output)
  if (
    result.code === 0 &&
    code === undefined &&
    !notStarted &&
    !/Failure \[/.test(output)
  ) {
    return undefined
  }
  if (notStarted) {
    return '"adb install" failed, because the device has not finished its start. Wait until the device shows its home screen, and then run the command again.'
  }
  const reason =
    code === undefined ? undefined : codeReason(code, target, output)
  if (code === undefined || reason === undefined) {
    return `"adb install" failed with exit code ${result.code}.${outputTail(output)}`
  }
  return `"adb install" failed with ${code}. ${reason}`
}

function codeReason(
  code: string,
  target: AdbInstallTarget,
  output: string,
): string | undefined {
  switch (code) {
    case 'INSTALL_FAILED_UPDATE_INCOMPATIBLE':
      return `The installed app has a different signing key. ${uninstallFix(target, output)}`
    case 'INSTALL_FAILED_VERSION_DOWNGRADE':
      return `The installed app is newer, and the device does not allow a downgrade. This occurs when the installed app is a release build. ${uninstallFix(target, output)}`
    case 'INSTALL_FAILED_NO_MATCHING_ABIS':
      return 'The build has no native code for the CPU architecture of the device. Install it on a device or an emulator with a CPU architecture that the build supports.'
    case 'INSTALL_FAILED_OLDER_SDK':
      return 'The Android version of the device is older than the minimum Android version of the build. Install it on a device or an emulator with a newer Android version.'
    case 'INSTALL_FAILED_INSUFFICIENT_STORAGE':
      return 'The device does not have sufficient free space. Delete apps or files on the device, and then run the command again.'
    case 'INSTALL_FAILED_USER_RESTRICTED':
    case 'INSTALL_FAILED_ABORTED':
      return 'The device did not accept the install. Accept the install prompt on the device, or turn on "Install via USB" in the developer options. Then run the command again.'
    case 'INSTALL_FAILED_INVALID_APK':
      return damagedFileFix(target)
  }
  return code.startsWith('INSTALL_PARSE_FAILED_')
    ? damagedFileFix(target)
    : undefined
}

/** DevHub never uninstalls (principle 9): it gives the command and stops. */
function uninstallFix(target: AdbInstallTarget, output: string): string {
  const appId =
    target.appId ?? /package (\S+) signatures do not match/i.exec(output)?.[1]
  const command =
    appId === undefined
      ? `${formatCommand([target.adb, '-s', target.serial, 'uninstall'])} <app ID>`
      : formatCommand(adbUninstallCommand(target.adb, target.serial, appId))
  return [
    'To install this build, uninstall the app first. The uninstall deletes the app data on the device:',
    `  ${command}`,
    'Then run the command again.',
  ].join('\n')
}

function damagedFileFix(target: AdbInstallTarget): string {
  return `The device cannot read the file. The stored file can be damaged. Delete the folder ${path.dirname(target.apk)}, and then run devhub sync in the project to download the build again.`
}
