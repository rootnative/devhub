# DevHub by Root Native

**Keep every dev build. Launch any one in one click.**

`@rootnative/devhub` is a CLI and a core library for Expo developers. It
keeps every development build on your machine, finds the build that matches
your current code by its native fingerprint, and starts a simulator or an
emulator with that build in one action.

> **Status:** `0.0.0-alpha.0`, the first alpha. DevHub downloads your EAS
> dev client builds before EAS deletes them. It installs a stored build on
> a running Android emulator or device, or on a booted iOS simulator.
> `devhub ui` shows your builds and devices on a local page. The
> fingerprint match and the launch come in later milestones. See the
> [CHANGELOG](https://github.com/rootnative/devhub/blob/main/packages/devhub/CHANGELOG.md).

Source, design, and roadmap: https://github.com/rootnative/devhub

## Install

```bash
npm install --global @rootnative/devhub
devhub --help
```

To run one command with no install, use `npx @rootnative/devhub <command>`,
for example `npx @rootnative/devhub list`. The daily sync below runs
`devhub`, so it needs the global install.

## Requirements

- Node 20.19 or later.
- [eas-cli](https://github.com/expo/eas-cli) with a login. DevHub runs `eas`
  when it is on your `PATH`. If it is not, DevHub runs `npx --yes eas-cli`,
  which uses the eas-cli of the project when the project has one. A global
  install is not necessary. Log in one time with `npx eas-cli login` or
  `eas login`. DevHub uses that login, and never reads, asks for, or stores
  a token.

## Commands

| Command | What it does |
| --- | --- |
| `devhub sync` | Downloads each finished EAS dev client build of the project in the current folder that the store does not have. |
| `devhub sync --all` | Runs the sync for each project folder that `devhub sync` saw before. |
| `devhub list` | Shows the stored builds: project, platform, profile, app version, git commit, date, and the EAS expiry date. |
| `devhub where <id>` | Prints the path of a stored build file. `<id>` is the EAS build ID, or a unique start of it. |
| `devhub devices` | Lists the Android emulators and devices that adb sees, and on macOS the booted iOS simulators, with their state. |
| `devhub install <id>` | Installs a stored build on a ready Android emulator or device, or on a booted iOS simulator (macOS only). |
| `devhub match` | Calculates the native fingerprint of the project in the current folder, and shows the stored builds with the same EAS fingerprint. A match needs no new build. |
| `devhub ui` | Starts a local server, and opens the DevHub page in the browser. The page shows the stored builds and the devices, installs a build with one click, and syncs each project. |

Options of `devhub sync`:

- `--profile <name>` also syncs this build profile. Give it again for each
  other profile.
- `--dry-run` shows what the sync downloads, and downloads nothing.
- `--json` prints the result as JSON.

`devhub list`, `devhub where`, `devhub devices`, `devhub install`,
`devhub match`, and `devhub ui` also accept `--json`.
Results go to stdout.
Progress and warnings go to stderr. The exit code is `0` for success, `1` for
a failure, and `2` for a usage error.

An AI agent can read `llms.txt` in the package. It gives the help of each
command, the type of each `--json` output, and the core API of the installed
version.

### Which builds DevHub keeps

DevHub reads `eas.json` and syncs each build profile with
`"developmentClient": true`. It follows `extends`, and it reads the `android`
and `ios` blocks, the same as eas-cli. A profile that is a dev client only on
iOS gives only its iOS builds.

DevHub keeps APKs, iOS simulator builds, and iOS device builds (`.ipa`). An
`.ipa` cannot install after its provisioning profile expires, but it stays in
the build history.

A build that EAS deleted before the first sync is "expired before sync".
DevHub cannot get it back. A daily sync prevents this.

A dev client is a debug build. Its JavaScript runs in development mode, so it
does not show the real speed of your app in production.

### Devices

`devhub devices` runs `adb devices -l`. DevHub uses the first
`platform-tools/adb` in `ANDROID_HOME`, `ANDROID_SDK_ROOT`, or the default
Android SDK folder of your system, and else `adb` from your `PATH`.

A device in the state `ready` can get a build. For a device in another
state, DevHub writes the fix to stderr. For example, an `unauthorized`
device needs you to accept the USB debugging prompt on it.

A ready emulator shows its AVD name, from `adb emu avd name`. If the
emulator console does not answer, the emulator shows its model name.

On macOS, `devhub devices` also runs `xcrun simctl list devices --json`. It
shows only the booted iOS simulators, with their iOS version. tvOS, watchOS,
and visionOS simulators do not show. If adb or Xcode is missing, DevHub
writes a warning and lists the devices of the other tool. The exit code is
`1` only when no tool works.

### Install a build

`devhub install <id>` installs a stored build on a device that runs now. It
does not start a device, and it does not open the app.

- An Android `.apk` installs with `adb -s <serial> install -r -d <apk>`.
  `-r` replaces the installed app, and `-d` lets you go back to an older
  build.
- An iOS simulator build installs with
  `xcrun simctl install <udid> <app>`, on macOS only. The first install
  unpacks the archive into the `extracted` folder of the store. The next
  install of the same build uses that folder again.

DevHub checks the build before it looks for a device. It stops, and gives
the fix, for these builds:

| Build | Why it cannot install | Fix |
| --- | --- | --- |
| Android App Bundle (`.aab`) | adb installs only an APK. | Set `"android": { "buildType": "apk" }` in the build profile in `eas.json`, and make a new build. |
| iOS device build (`.ipa`) | A simulator cannot run it. | Set `"ios": { "simulator": true }` in the build profile in `eas.json`, and make a new build. |
| Any iOS build on Windows or Linux | iOS simulators run only on macOS. | Install the build on a Mac. |

When `adb install` fails, DevHub reads the adb output and gives the cause
and the fix:

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
`adb uninstall` command and stops. It never uninstalls an app, because an
uninstall deletes the app data. For a code that is not in the table, DevHub
prints the last lines of the adb output.

DevHub uses the one ready device of the build's platform: an Android
emulator or device for an Android build, and a booted simulator for an iOS
build. When two or more are ready, select one with `--device <id>`, where
`<id>` is the adb serial or the simulator UDID. `devhub devices` shows the
IDs. When no device is ready, DevHub gives the reason for each device.

To load the JavaScript of the project, run `npx expo start` in the project
folder, and press `a` for Android or `i` for iOS. Expo CLI then opens the
installed dev client with the URL of Metro.

### Keep your local builds

DevHub is also an Expo build cache provider. With it, `npx expo run:android`
and `npx expo run:ios` store each new build, and install a stored build in
place of a new build when the native code did not change.

1. Add DevHub to the project:

   ```bash
   npm install --save-dev @rootnative/devhub
   ```

2. Add the provider to the app config (`app.json` or `app.config.js`):

   ```json
   {
     "expo": {
       "buildCacheProvider": { "plugin": "@rootnative/devhub/cache-provider" }
     }
   }
   ```

   Expo SDK 53 reads the key under `expo.experiments`.

The first `npx expo run:android` builds the app, and DevHub stores the APK.
The next run with the same native code installs the stored APK, and Gradle
does not run. iOS works the same for a simulator. Expo CLI does not use a
build cache provider for an iOS device.

A stored build serves a run when all of these agree:

- The fingerprint of the platform. DevHub calculates it with the
  `@expo/fingerprint` of the project, the same as `devhub match`.
- The Android variant (`--variant`, default `debug`) or the iOS
  configuration (`--configuration`, default `Debug`).
- Android: the APK has native code for each ready device. A debug build of
  `npx expo run:android` holds only the ABI of the device that it was made
  for. With `--device <name>`, DevHub checks only that device. With
  `--all-arch`, the APK must hold all four ABIs.
- iOS: a Mac with the same architecture made the build.

When DevHub is not sure that a stored build fits, Expo CLI builds the app.
DevHub does not use or store a build of a run with `--scheme`. When DevHub
cannot read or write the store, it gives a warning, and the run continues.
DevHub serves only the builds that `npx expo run:*` made, not the builds
that `devhub sync` downloaded from EAS.

### Match a build

`devhub match` tells you which stored builds work with the code in the
current folder. A dev client needs a new build only when the native
fingerprint changes. DevHub runs the `@expo/fingerprint` of the project,
with the same options as eas-cli, and compares the hash of each platform
with the EAS fingerprint of each stored build.

```text
Project: /Users/me/my-app (@expo/fingerprint 0.20.13)

android  3f2a0c9e1b7d4a6f8e2c5b1d9a7f3e6c4b8d2a1f
  ID        PLATFORM  PROFILE      VERSION  COMMIT   CREATED     EAS EXPIRY
  5d1c9a2e  android   development  1.4.0    8b1f2c3  2026-10-12  2026-11-11

ios  9c1b7e4d2a6f0c3e8b5d1a7f4e2c9b6d3a8f1e5c
  No stored build matches this fingerprint.
```

- `--platform <name>` limits the match to `android` or `ios`. Give it
  again for the other platform. The default is both.
- `--json` prints the result as JSON, with the full record of each match.

The exit code is `1` when no stored build matches, so a script can make a
new build only when it is necessary. The project folder is the nearest
folder with a `package.json`, the same as for Expo CLI and eas-cli. In a
monorepo, run the command in the app folder. The project needs Expo SDK 52
or later, which ships `expo/fingerprint`.

When a build does not match, compare the hash with the fingerprint on the
EAS build page. A different `@expo/fingerprint` version, a change to a
native input, or an `env` value of the build profile that changes the app
config can give a different hash. DevHub applies no `env` of a build
profile.

### The local page

`devhub ui` starts a server on your machine, prints its URL, and opens the
URL in your browser. Press Ctrl+C to stop the server.

- `--port <n>` sets the port. The default is a free port.
- `--no-open` prints the URL, and does not open the browser.
- `--json` prints the URL and the port as JSON.

The page shows the stored builds of each project and the devices that run
now. It reads the devices again when you return to the window, and when
you click Refresh.

Click Install on a build to install it on the ready device of its platform.
When two or more devices are ready, select the device in the menu. The
button is off when no device of the platform is ready. A build that
`devhub install` refuses has no button, and shows the reason and the fix.
When an install fails, the page shows the same message as the CLI.

Click Sync to run `devhub sync --all`. The terminal of `devhub ui` shows
the progress, and the page shows the result of each project when the sync
ends. Only one sync runs at a time: while a sync runs from the terminal or
from a second tab, the page shows that message.

The server listens on `127.0.0.1` only, never on your network. Each run
makes a new token, and puts it in the URL after `#token=`. Each API call
must send the token, so a different page in your browser cannot use the
API. Open the URL that `devhub ui` prints. A URL with `localhost` does not
work.

### The store

The store is one folder for all your projects. It is never inside a project
folder.

| System | Folder |
| --- | --- |
| macOS | `~/Library/Application Support/devhub` |
| Windows | `%LOCALAPPDATA%\devhub` |
| Linux | `$XDG_DATA_HOME/devhub`, or `~/.local/share/devhub` |

Set `DEVHUB_HOME` to use a different folder, for example on an external
disk. A dev client build can be more than 100 MB.

The `extracted` folder in the store holds the unpacked iOS simulator builds.
You can delete it at any time. The next install unpacks the build again.

The store can also hold local builds: builds that `npx expo run:android`
and `npx expo run:ios` made on your machine. `devhub list` shows the
profile of a local build as `local` and its variant, for example
`local debug`, and no EAS expiry date. Its ID is a UUID that DevHub makes.
`devhub where`, `devhub install`, and `devhub match` accept a local build
the same as an EAS build.

## Sync every day

EAS deletes a build after its retention period. Run `devhub sync` once in
each project folder. Then a daily `devhub sync --all` keeps the builds of
each project, also the projects that you do not work on now.

A scheduled job does not read your shell profile, so it can have a short
`PATH`. The job must find `node`, `devhub`, and `eas` or `npx`. `npx` is in
the folder of `node`. Run this command to see their folders, and put each
folder in the `PATH` of the job:

```bash
command -v node devhub eas npx
```

### cron (macOS and Linux)

Run `crontab -e`, and add these two lines. Replace the `PATH` value with the
folders from `command -v`.

```
PATH=/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin
0 9 * * * devhub sync --all >> "$HOME/devhub-sync.log" 2>&1
```

cron does not run a job that it missed while the computer was asleep or off.
On macOS, launchd is a better choice for a laptop.

### launchd (macOS)

Save this file as
`~/Library/LaunchAgents/io.github.rootnative.devhub.sync.plist`. Replace the
path of `devhub`, the `PATH` value, and `YOU` with your values.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>io.github.rootnative.devhub.sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/devhub</string>
    <string>sync</string>
    <string>--all</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>9</integer>
    <key>Minute</key>
    <integer>0</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>/Users/YOU/Library/Logs/devhub-sync.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/YOU/Library/Logs/devhub-sync.log</string>
</dict>
</plist>
```

Load the job, and run it one time to test it:

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/io.github.rootnative.devhub.sync.plist
launchctl kickstart gui/$(id -u)/io.github.rootnative.devhub.sync
```

If the computer is asleep at 9:00, launchd runs the job when the computer
wakes. To remove the job, run
`launchctl bootout gui/$(id -u)/io.github.rootnative.devhub.sync`.

### Task Scheduler (Windows)

Run these commands in PowerShell. `-StartWhenAvailable` runs a missed sync
when the computer is on again.

```powershell
$action = New-ScheduledTaskAction -Execute 'cmd.exe' `
  -Argument '/c devhub sync --all >> "%LOCALAPPDATA%\devhub-sync.log" 2>&1'
$trigger = New-ScheduledTaskTrigger -Daily -At 9am
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable
Register-ScheduledTask -TaskName 'DevHub by Root Native sync' `
  -Action $action -Trigger $trigger -Settings $settings
```

To test the task, run `Start-ScheduledTask -TaskName 'DevHub by Root Native sync'`.
To remove it, run
`Unregister-ScheduledTask -TaskName 'DevHub by Root Native sync'`.

Two syncs cannot run at the same time. If a scheduled sync starts while
another sync runs, it stops with a message and exit code `1`.

## License

MIT
