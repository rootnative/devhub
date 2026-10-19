<!--
The source of packages/devhub/llms.txt. Edit this file, then run
"pnpm run build" and "pnpm run build:llms", and commit both files.
scripts/build-llms.mjs fills each placeholder from the build. This comment
is not in the output.
-->
# DevHub by Root Native (@rootnative/devhub)

> A CLI and a core library for Expo developers. DevHub keeps every Expo
> development build (dev client) on the machine, and installs a stored build
> on a running Android emulator or device, or on a booted iOS simulator.

Version: {{version}}. This file describes this version only.

Source: https://github.com/rootnative/devhub

## What ships

- `devhub sync` downloads the EAS dev client builds of a project into the
  store, before EAS deletes them. `devhub sync --all` does this for each
  project that `devhub sync` saw before.
- `devhub list` shows the stored builds. `devhub where` gives the path of a
  build file.
- `devhub devices` lists the Android emulators and devices, and on macOS the
  booted iOS simulators.
- `devhub install` installs a stored build on a device that runs now.
- `devhub match` calculates the native fingerprint of a project with the
  project's own `expo/fingerprint`, and shows the stored builds with the
  same EAS fingerprint.
- `devhub ui` serves a local page with the same functions, on 127.0.0.1.
- `@rootnative/devhub/cache-provider` is an Expo build cache provider.
  `npx expo run:android` and `npx expo run:ios` then store each new build,
  and install a stored build when the native code did not change.

NOT IMPLEMENTED, do not call: the import of a build file,
the launch (boot a device, open the app), launch profiles, prune, and the
desktop app. They are the plan only.

## Requirements

- Node 20.19 or later. Run `npx @rootnative/devhub <command>`, or install
  the package globally to get the `devhub` command.
- For `devhub sync`: eas-cli with a login (`eas login` or
  `npx eas-cli login`). DevHub runs `eas` from `PATH`, or `npx --yes eas-cli`
  when `eas` is not on `PATH`. DevHub never reads, asks for, or stores a
  token.
- For Android: adb from the Android SDK Platform-Tools. DevHub uses the
  first `platform-tools/adb` in `ANDROID_HOME`, `ANDROID_SDK_ROOT`, or the
  default SDK folder of the system, and else `adb` from `PATH`.
- For iOS: Xcode, on macOS only.

## Rules for an agent

- Add `--json` to each command. Then stdout holds one JSON value and nothing
  else. Progress and warnings go to stderr.
- The exit code is `0` for success, `1` for a failure, and `2` for a usage
  error. After a failure, stdout is empty and stderr holds the message, with
  two exceptions. `devhub devices --json` prints its JSON and exits with `1`
  when each device tool fails. `devhub sync --json` prints its JSON and
  exits with `1` when a project fails. `devhub match --json` prints its
  JSON and exits with `1` when no stored build matches.
- `<id>` is the EAS build ID, or a unique start of it. `devhub list --json`
  gives each full ID.
- `devhub install` does not start a device, and does not open the app.
  Start the emulator or the simulator first. Then run `npx expo start` in
  the project folder, and press `a` or `i`, to load the JavaScript.
- When two or more devices of the build's platform are ready,
  `devhub install` stops with exit code `2`. Give `--device <id>` with an ID
  from `devhub devices --json`.
- DevHub never uninstalls an app. For a signing key conflict, it prints the
  `adb uninstall` command and stops. An uninstall deletes the app data, so
  ask the user before you run that command.
- `devhub install` refuses an Android App Bundle (`.aab`), an iOS device
  build (`.ipa`), and each iOS build on Windows or Linux. `installProblem`
  in `devhub list --json` gives the reason and the fix before you try.
- `devhub match` runs in the project folder, or in a folder inside it. It
  needs the dependencies of the project installed, and Expo SDK 52 or
  later. It runs no `eas` command and no network call. A match is a
  `ListedBuild`: give its `id` to `devhub install`.
- `devhub ui` runs until Ctrl+C. To read data, use the commands with
  `--json`, not the page.
- Only one sync runs at a time. A second sync stops with exit code `1` and
  a message that names the process of the first one.
- A dev client is a debug build. Its JavaScript runs in development mode, so
  it does not show the speed of the app in production.

## CLI

{{cli}}

## JSON output

{{json}}

- `devhub where <id> --json` prints `{ "id": string, "path": string }`.
- `devhub ui --json` prints `{ "url": string, "port": number }`, and the
  server then runs until Ctrl+C.

Each path is absolute. Each date is an ISO 8601 string. A build in
`devhub list --json` has `source`: `"eas"` for a build that `devhub sync`
downloaded, and `"local"` for a build that `npx expo run:*` made. An EAS
build has `eas`, the record of `eas build:list --json` without changes, so
it can have more fields than the type names. eas-cli drops each field with
a `null` value, so an absent field means "no value". A local build has
`local` in place of `eas`. The `id` of a local build is a UUID that DevHub
made, and `devhub where` and `devhub install` accept it the same as an EAS
build ID.

## The store

One folder holds the builds of all projects. It is never inside a project
folder. Read it with the CLI. Do not write into it.

```text
<DEVHUB_HOME>/
  projects.json            each project folder that devhub sync saw
  sync.lock                the process ID of the sync that runs now
  builds/<id>/             the EAS build ID, or a UUID for a local build
    build.json             the record. A folder without it is incomplete.
    <file>                 .apk, .aab, .tar.gz (iOS simulator), or .ipa
  extracted/<id>/          the unpacked iOS simulator build, a cache
```

`DEVHUB_HOME` sets the folder. The default is
`~/Library/Application Support/devhub` on macOS, `%LOCALAPPDATA%\devhub` on
Windows, and `$XDG_DATA_HOME/devhub` or `~/.local/share/devhub` on Linux.

## Expo build cache provider

Set it up in a project:

1. Install `@rootnative/devhub` as a dev dependency of the project. Expo CLI
   resolves the plugin from the project folder, not from a global install.
2. Add `"buildCacheProvider": { "plugin": "@rootnative/devhub/cache-provider" }`
   to `expo` in the app config. Expo SDK 53 reads it under
   `expo.experiments`.

Rules:

- Expo CLI calls the provider only for `npx expo run:*`, and on iOS only for
  a simulator. `--binary` turns it off for one run.
- A stored build serves a run only when the platform, the fingerprint, and
  the variant (`--variant`, default `debug`; `--configuration`, default
  `Debug`) agree. On Android the APK must have native code for each ready
  device, or for the device that `--device` names, and for all four ABIs
  with `--all-arch`. On iOS a Mac with the same `process.arch` made it.
- Only builds that `npx expo run:*` made serve a run. A build from
  `devhub sync` does not.
- A run with `--scheme` (iOS) does not use or store a build.
- The provider never fails a run. It prints its lines with the prefix
  `› DevHub:`, and Expo CLI builds the app when no stored build fits.
- `devhub list` shows a stored local build with the profile `local` and its
  variant. `devhub match` shows it as a match.

## Core API

`import { listBuilds } from '@rootnative/devhub'`. The package is ESM only,
for Node. The types are in `dist/index.d.ts`. The API can change in each
version before `1.0.0`.

{{exports}}
