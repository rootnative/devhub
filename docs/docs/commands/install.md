---
title: devhub install
description: Install a stored build on a running emulator, Android device, or iOS simulator.
---

# devhub install

Installs a stored build on a device that is ready: an Android build on an
emulator or a device, or an iOS simulator build on a booted simulator
(macOS only).

```bash
devhub install <id> [options]
```

`<id>` is the build ID, or the start of it. `devhub list` shows the
builds, and `devhub devices` shows the devices.

| Option | What it does |
| --- | --- |
| `--device <id>` | The adb serial or the simulator UDID of the device. Necessary when two or more devices are ready. |
| `--json` | Print the build and the device as JSON. See [JSON output](../reference/json-output.md). |
| `-h`, `--help` | Show the help. |

DevHub does not start a device, and does not open the app. Start the
emulator or the simulator first.

## Example

```bash
devhub install 5d1c
```

```text
Installing the build 5d1c9a2e-4b7f-4c1a-9e3d-2f6a8b0c1d2e on Pixel_8_API_35 (emulator-5554).
Installed the build 5d1c9a2e-4b7f-4c1a-9e3d-2f6a8b0c1d2e on Pixel_8_API_35 (emulator-5554).
```

Then load your JavaScript: run `npx expo start` in the project folder,
and press `a` for Android or `i` for iOS. Expo CLI opens the installed dev
client with the URL of Metro.

## The device

DevHub uses the one ready device of the build's platform: an Android
emulator or device for an Android build, and a booted simulator for an iOS
build.

- When two or more devices of that platform are ready, DevHub stops with
  exit code `2`. Give `--device <id>`.
- When no device of that platform is ready, DevHub gives the reason for
  each device.

## How DevHub installs

| Build | Command |
| --- | --- |
| Android `.apk` | `adb -s <serial> install -r -d <apk>`. `-r` replaces the installed app, and `-d` lets you go back to an older build. |
| iOS simulator build | `xcrun simctl install <udid> <app>`, on macOS only. |

The first install of an iOS simulator build unpacks its archive into the
`extracted` folder of the [store](../guides/store.md). The next install of
the same build uses that folder again.

## Builds that DevHub cannot install

DevHub checks the build before it looks for a device. It stops, and gives
the fix, for these builds:

| Build | Why it cannot install | Fix |
| --- | --- | --- |
| Android App Bundle (`.aab`) | adb installs only an APK. | Set `"android": { "buildType": "apk" }` in the build profile in `eas.json`, and make a new build. |
| iOS device build (`.ipa`) | A simulator cannot run it. | Set `"ios": { "simulator": true }` in the build profile in `eas.json`, and make a new build. |
| An iOS build on Windows or Linux | iOS simulators run only on macOS. | Install the build on a Mac. |

`devhub list --json` gives this reason in `installProblem`, before you
try the install.

## When adb install fails

DevHub reads the adb output, and gives the cause and the fix:

| adb output | Cause |
| --- | --- |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | The installed app has a different signing key. |
| `INSTALL_FAILED_VERSION_DOWNGRADE` | The installed app is newer, and the device does not allow a downgrade. This occurs when the installed app is a release build. |
| `INSTALL_FAILED_NO_MATCHING_ABIS` | The build has no native code for the CPU architecture of the device. |
| `INSTALL_FAILED_OLDER_SDK` | The Android version of the device is older than the minimum Android version of the build. |
| `INSTALL_FAILED_INSUFFICIENT_STORAGE` | The device does not have sufficient free space. |
| `INSTALL_FAILED_USER_RESTRICTED`, `INSTALL_FAILED_ABORTED` | The device did not accept the install. Accept the prompt, or turn on "Install via USB" in the developer options. |
| `INSTALL_PARSE_FAILED_*`, `INSTALL_FAILED_INVALID_APK` | The device cannot read the file. The stored file can be damaged. |
| `Can't find service: package` | The device has not finished its start. |

For the first two, the fix is to uninstall the app. DevHub prints the
`adb uninstall` command, and stops.

:::warning

DevHub never uninstalls an app, because an uninstall deletes the app data.
Run the `adb uninstall` command yourself only when you do not need that
data.

:::

For an adb code that is not in the table, DevHub prints the last lines of
the adb output.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | DevHub installed the build. |
| `1` | DevHub cannot install the build, no device is ready, or the install failed. |
| `2` | A usage error, for example two ready devices and no `--device`. |
