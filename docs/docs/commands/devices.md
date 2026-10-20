---
title: devhub devices
description: List the Android emulators and devices, and the iOS simulators, that can get a build.
---

# devhub devices

Lists the Android emulators and devices that adb sees, and on macOS the
iOS simulators that run now. DevHub can install a build on a device in the
state `ready`.

```bash
devhub devices [options]
```

| Option | What it does |
| --- | --- |
| `--json` | Print the devices as JSON. See [JSON output](../reference/json-output.md). |
| `-h`, `--help` | Show the help. |

## Example

```text
Note: the device R5CT21ABCDE is not ready. Unlock the device, and accept the USB debugging prompt on it.
ID                                    PLATFORM  KIND       NAME                      STATE
emulator-5554                         android   emulator   Pixel_8_API_35            ready
R5CT21ABCDE                           android   physical   R5CT21ABCDE               unauthorized
6F1D2C3B-4A5E-4F60-9A7B-8C9D0E1F2A3B  ios       simulator  iPhone 16 Pro (iOS 18.6)  ready
```

The `ID` is the adb serial or the simulator UDID. Give it to
`devhub install --device`.

## Android

DevHub runs `adb devices -l`. See [adb](../installation.md#adb) for the
adb that DevHub uses. A ready emulator shows its AVD name. If the emulator
console does not answer, the emulator shows its model name.

A device that is not ready gets a note on stderr with the fix:

| State | Fix |
| --- | --- |
| `unauthorized` | Unlock the device, and accept the USB debugging prompt on it. |
| `authorizing` | adb waits for the device to accept the connection. Wait, and run the command again. |
| `offline` | The device does not answer adb. Connect the device again, or restart the emulator. |
| `no permissions` | On Linux, add a udev rule for the device. See [Run apps on a hardware device](https://developer.android.com/studio/run/device). |
| Another state, for example `recovery` | Start Android on the device. |

## iOS

On macOS, DevHub runs `xcrun simctl list devices --json`. It shows only
the booted iOS simulators, with their iOS version. tvOS, watchOS, and
visionOS simulators do not show. DevHub does not list an iPhone.

## When a tool is missing

When adb or Xcode is missing, DevHub writes a warning with the fix, and
lists the devices of the other tool. The exit code is `1` only when no
tool works. On Windows and Linux, DevHub does not run `xcrun`.
