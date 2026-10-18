# Changelog

All notable changes to `@rootnative/devhub` are recorded here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Before `1.0.0`, a minor version can contain a breaking change. The release
notes name each one.

## [Unreleased]

Nothing is on npm yet.

### Added

- The `devhub` CLI with `--help` and `--version`.
- `devhub sync` downloads each finished EAS dev client build of the current
  project that the store does not have. It reads the dev client profiles
  from `eas.json`, with `extends` and the `android` and `ios` blocks, the
  same as eas-cli. It accepts `--profile <name>`, `--dry-run`, and `--json`.
  It runs `eas` from `PATH`, or `npx --yes eas-cli` when `eas` is not on
  `PATH`.
- `devhub sync --all` syncs each project folder that `devhub sync` saw
  before. A project that fails does not stop the others.
- `devhub list` shows the stored builds. `--json` prints each record with
  the path of its file.
- `devhub where <id>` prints the path of a stored build file. `<id>` is the
  EAS build ID, or a unique start of it.
- `devhub devices` lists the Android emulators and devices that adb sees,
  with their state, and the fix for a device that is not ready. A ready
  emulator shows its AVD name. On macOS, it also lists the booted iOS
  simulators. It accepts `--json`.
- `devhub install <id>` installs a stored Android `.apk` on a ready Android
  emulator or device, with `adb install -r -d`. On macOS, it installs an iOS
  simulator build on a booted simulator, with `xcrun simctl install`. The
  first install unpacks the archive into `extracted/` in the store, and the
  next install uses it again. `--device <id>` selects the device by its adb
  serial or its simulator UDID when two or more are ready. A `--device` of
  the other platform stops the install. It accepts `--json`. Before it
  looks for a device, it stops for an `.aab`, an iOS device build (`.ipa`),
  or an iOS build on Windows or Linux, and gives the fix. When
  `adb install` fails, it gives the cause and the fix for each common
  failure code. For a signing key conflict or a refused downgrade, it prints
  the `adb uninstall` command, and does not uninstall the app.
- `devhub ui` starts a local server for the DevHub page, prints its URL,
  and opens the URL in the browser. The server listens on `127.0.0.1` only.
  Each run makes a new token, and each API call must send it. The API gives
  the same JSON as `devhub list`, `devhub devices`, `devhub install`, and
  `devhub sync --all` with `--json`. It accepts `--port <n>`, `--no-open`,
  and `--json`. The page itself is not in the package yet.
- The store: one folder for all projects, in the data folder of the OS, or
  in `DEVHUB_HOME`. Each build has a folder with its file and a `build.json`
  that keeps the EAS record without changes. A sync writes `build.json`
  last, so an interrupted sync never leaves a record of a broken file. A
  lock stops a second sync while one runs.
- The core API that the CLI uses: `syncProjects`, `scanStore`, `findBuild`,
  `devClientProfiles`, `resolveHome`, `listDevices`, `selectDevice`,
  `resolveAdb`, `installBuild`, `unpackIosBuild`, and the `eas`, `adb`,
  `simctl`, and `tar` command builders.
- The flows of the CLI commands in the core API: `findStoredBuild`,
  `listBuilds`, `installStoredBuild`, `deviceReport`, and `syncBuilds`. Each
  one returns a result with the JSON of its command, or an error message,
  and writes nothing to stdout or stderr.
- The runtime dependencies `cross-spawn` and `json5`. On Windows, `eas` is a
  `.cmd` file, and cross-spawn runs it with each argument escaped, with no
  shell string. json5 reads an `eas.json` with comments, which eas-cli
  accepts.
