---
title: Installation
description: Install the devhub command, and set up eas-cli, adb, and Xcode for it.
---

# Installation

## Requirements

| Tool | Necessary for | Notes |
| --- | --- | --- |
| Node 20.19 or later | Each command | |
| eas-cli with a login | `devhub sync` | A global install is not necessary. See [eas-cli](#eas-cli). |
| adb (Android SDK Platform-Tools) | Android devices | See [adb](#adb). |
| Xcode | iOS simulators | macOS only. |

## Install the CLI

Install DevHub globally to get the `devhub` command:

```bash
npm install --global @rootnative/devhub
devhub --help
```

To run one command with no install, use `npx`:

```bash
npx @rootnative/devhub list
```

A [daily sync](./guides/daily-sync.md) runs `devhub`, so it needs the
global install.

Check the install:

```bash
devhub --version
```

Then check the tools in the table above. [`devhub doctor`](./commands/doctor.md)
gives the fix for each tool that is missing:

```bash
devhub doctor
```

## Add DevHub to a project

The [cache provider](./guides/local-builds.md) runs inside
`npx expo run:*`. Expo CLI loads it from the project folder, not from a
global install. For the cache provider, add DevHub as a dev dependency of
the project:

```bash
npm install --save-dev @rootnative/devhub
```

The CLI commands do not need this step.

## eas-cli

`devhub sync` reads your EAS builds with eas-cli, so eas-cli must have a
login. Log in one time:

```bash
npx eas-cli login
```

DevHub runs `eas` when it is on your `PATH`. When it is not, DevHub runs
`npx --yes eas-cli`, which uses the eas-cli of the project when the project
has one. Each copy of eas-cli uses the same login.

DevHub never reads, asks for, or stores a token. It uses the login of
eas-cli.

## adb

DevHub uses the first `platform-tools/adb` that it finds in these folders:

1. `ANDROID_HOME`
2. `ANDROID_SDK_ROOT`
3. The default Android SDK folder of your system:

   | System | Folder |
   | --- | --- |
   | macOS | `~/Library/Android/sdk` |
   | Windows | `%LOCALAPPDATA%\Android\Sdk` |
   | Linux | `~/Android/Sdk` |

When none of them has adb, DevHub runs `adb` from your `PATH`. Android
Studio installs the SDK in the default folder.

## Xcode

On macOS, DevHub runs `xcrun simctl` to list the simulators and to install
a build. `xcrun simctl` comes with Xcode.

## Uninstall

```bash
npm uninstall --global @rootnative/devhub
```

The uninstall does not delete your stored builds. To delete them, delete
the [store folder](./guides/store.md).
