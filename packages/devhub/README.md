# RootNative DevHub

**Keep every dev build. Launch any one in one click.**

`@rootnative/devhub` is a CLI and a core library for Expo developers. It
keeps every development build on your machine, finds the build that matches
your current code by its native fingerprint, and starts a simulator or an
emulator with that build in one action.

> **Status:** Milestone 1, "Keep". DevHub downloads your EAS dev client
> builds before EAS deletes them. Install and launch come in later
> milestones. The package is not on npm yet.

Source, design, and roadmap: https://github.com/rootnative/devhub

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
| `devhub devices` | Lists the Android emulators and devices that adb sees, with their state. |

Options of `devhub sync`:

- `--profile <name>` also syncs this build profile. Give it again for each
  other profile.
- `--dry-run` shows what the sync downloads, and downloads nothing.
- `--json` prints the result as JSON.

`devhub list`, `devhub where`, and `devhub devices` also accept `--json`.
Results go to stdout.
Progress and warnings go to stderr. The exit code is `0` for success, `1` for
a failure, and `2` for a usage error.

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
Register-ScheduledTask -TaskName 'RootNative DevHub sync' `
  -Action $action -Trigger $trigger -Settings $settings
```

To test the task, run `Start-ScheduledTask -TaskName 'RootNative DevHub sync'`.
To remove it, run
`Unregister-ScheduledTask -TaskName 'RootNative DevHub sync'`.

Two syncs cannot run at the same time. If a scheduled sync starts while
another sync runs, it stops with a message and exit code `1`.

## License

MIT
