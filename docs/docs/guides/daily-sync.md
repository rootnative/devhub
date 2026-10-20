---
title: Sync every day
description: Run devhub sync --all once a day with cron, launchd, or Task Scheduler, so you keep each EAS build before EAS deletes it.
---

# Sync every day

EAS deletes a build after its retention period. A daily
`devhub sync --all` downloads each new build of each project before that
date, also for the projects that you do not work on now.

## Before you start

1. Install DevHub globally. The job runs the `devhub` command. See
   [Installation](../installation.md).
2. Run `devhub sync` one time in each project folder. Then
   `devhub sync --all` knows the project.

A scheduled job does not read your shell profile, so its `PATH` can be
short. The job must find `node`, `devhub`, and `eas` or `npx`. `npx` is in
the folder of `node`. Run this command to see their folders:

```bash
command -v node devhub eas npx
```

Put each folder in the `PATH` of the job.

## launchd (macOS)

launchd runs a job that it missed while the computer was asleep, so it is
the best choice for a laptop.

Save this file as
`~/Library/LaunchAgents/io.github.rootnative.devhub.sync.plist`. Replace
the path of `devhub`, the `PATH` value, and `YOU` with your values.

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
wakes. To remove the job, run:

```bash
launchctl bootout gui/$(id -u)/io.github.rootnative.devhub.sync
```

## cron (macOS and Linux)

Run `crontab -e`, and add these two lines. Replace the `PATH` value with
the folders from `command -v`.

```text
PATH=/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin
0 9 * * * devhub sync --all >> "$HOME/devhub-sync.log" 2>&1
```

cron does not run a job that it missed while the computer was asleep or
off.

## Task Scheduler (Windows)

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

To test the task, run:

```powershell
Start-ScheduledTask -TaskName 'DevHub by Root Native sync'
```

To remove it, run:

```powershell
Unregister-ScheduledTask -TaskName 'DevHub by Root Native sync'
```

## Two syncs at the same time

Two syncs cannot run at the same time. If a scheduled sync starts while
another sync runs, it stops with a message and exit code `1`. The next
day's sync downloads what it did not.
