# Changelog

All notable changes to `@rootnative/devhub` are recorded here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Before `1.0.0`, a minor version can contain a breaking change. The release
notes name each one.

## [Unreleased]

### Added

- `devhub list` names the store folder on its first line, and
  `devhub list --json` has it as `store`. Then you can see which store a
  command uses, for example when `DEVHUB_HOME` is set in one shell only.

### Changed

- `installProblem` in `devhub list --json` and `devhub match --json` names
  no build ID. It starts with "This build", because the record has `id`,
  and the page shows it under the row of the build. `devhub install` still
  names the full ID in its own message, because there the ID is the input.
- The `devhub ui` page uses the colors of DevHub: an amber accent on grey
  surfaces, in light and dark mode. The app bar shows the DevHub mark.
- The app bar of the `devhub ui` page shows the store folder under the
  title, and the EAS login state, Sync, and Refresh on the right. In a
  narrow window, the EAS login state and Sync are above the sections.
- In a wide window, the `devhub ui` page shows the builds of each project
  as a table, with one row for each build and a column for the start of
  its fingerprint. The full hash shows when you put the pointer on it. The
  builds come first, and the devices and the setup checks are next to them
  or under them.
- The `devhub ui` page cuts no text in a narrow column: each device shows
  its full name, its ID, and its fix, and each build shows its full
  profile. The setup checks show as one chip for each check, with the fix
  of each warning and failure under the chips.
- The `devhub ui` page shows icons: on Refresh, Sync, Install, and Check,
  on the state chips of the devices, the setup checks, and the EAS login,
  and for the kind of each device. The icons are SVG, and the page bundles
  only the icons that it uses, so the package gets no font file.

## [0.0.0-alpha.1] - 2026-10-20

The second alpha. DevHub finds the stored build that matches the native
code of a project, keeps each build that `npx expo run:*` makes, and checks
the tools that it needs. The launch of an app is not in this version.

Three checks are open. A CI run of the cache provider passed on Android, and
no run on iOS has passed yet. The provider uses the same code on both
platforms. `devhub match` gave the same hashes as `@expo/fingerprint` on a
real project, but no manual run has compared it with the fingerprint of a
real EAS build. On Windows, no manual run has confirmed that `devhub ui`
gives the browser its token.

### Added

- `devhub match` calculates the native fingerprint of the project in the
  current folder, with the project's own `expo/fingerprint` and the options
  of eas-cli, and shows the stored builds with the same fingerprint. A
  match needs no new build. It accepts `--platform <name>` and `--json`,
  and exits with `1` when no stored build matches. It stops when
  `@expo/fingerprint` finds no native inputs in the project, because that
  hash is the same for each such project, and it would match the builds of
  a different app.
- `@rootnative/devhub/cache-provider`, an Expo build cache provider. Add it
  to `buildCacheProvider` in the app config, and `npx expo run:android` and
  `npx expo run:ios` store each new build in the DevHub store. A later run
  with the same fingerprint and variant installs the stored build, and does
  not build the app. On Android the stored APK must have native code for
  each ready device. On iOS a Mac with the same architecture must have made
  it. The provider uses the per-platform fingerprint of `devhub match`. In
  a managed project, it does not store a build when the app config is newer
  than the last prebuild, because Expo CLI then builds the old native
  folder with the new fingerprint.
- The store holds local builds: builds that `npx expo run:*` made.
  `storeLocalBuild` copies an APK with the ABIs of its native code, or packs
  a `.app` folder into a `.tar.gz`, and gives the build a new UUID. `list`,
  `where`, `install`, `match`, and the `devhub ui` page show a local build
  with the profile `local` and its variant.
- `devhub doctor` checks Node, the store folder, eas-cli and its login,
  adb, and on macOS Xcode, and gives the fix for each problem. Each check
  is `ok`, `warn`, `fail`, or `skip`. A warning stops one feature, and a
  failure stops DevHub. The exit code is `1` when a check fails. It
  accepts `--json`. `devhub ui` serves it as `GET /api/doctor`, and the
  page shows it in a Setup section. The page runs the checks only on a
  click.
- `devhub whoami` shows the EAS login state: `signed-in` with the user
  name, `signed-out`, `no-cli`, or `failed`, with the fix. The exit code is
  `1` without a login. It accepts `--json`. `devhub ui` serves it as
  `GET /api/whoami`.
- The page of `devhub ui` shows the EAS login state under the Builds
  title. Without a login, the Sync button is off, and its tooltip gives
  the fix.
- `devhub install` and the install button of `devhub ui` compare the
  SHA-256 of the stored file with the record before the install, and refuse
  a file that differs. The message names both hashes and the fix.
- The public docs site at https://rootnative.github.io/devhub/. The README
  files link to it, and `homepage` in the package points at it.
- The core exports for these features:
  - Match: `findProjectRoot`, `resolveFingerprintModule`,
    `projectFingerprint`, `matchBuilds`, `matchesFingerprint`, and
    `hasMatch`.
  - Local builds and the cache provider: `createCacheProvider`,
    `storeLocalBuild`, `apkAbis`, `buildSummary`, `isLocalRecord`,
    `tarCreateCommand`, `adbAbiListCommand`, `primaryAbi`, and
    `ANDROID_ABIS`.
  - Doctor: `doctor`, `doctorPassed`, `NODE_MINIMUM`,
    `adbVersionCommand`, `parseAdbVersion`, `xcodeVersionCommand`, and
    `parseXcodeVersion`.
  - Login: `whoami` and `canSync`.

### Changed

- Each build in `devhub list --json` has `source`, `"eas"` or `"local"`. A
  local build has `local` in place of `eas`. A script that reads `eas` from
  each build must check `source` first.
- In the core types, `ListedBuild` and `BuildRecord` are unions of an EAS
  build and a local build. TypeScript code that reads `eas` must narrow the
  type first, with `source` or with `isLocalRecord`.
- A local build record has `schemaVersion` 2. DevHub `0.0.0-alpha.0` does
  not read it, and `devhub list` of that version says that a newer DevHub
  wrote it. EAS build records keep `schemaVersion` 1.

### Fixed

- The sync reads "Not logged in" on stdout, where eas-cli 16 writes it. A
  sync with no login showed the exit code and the npm warnings instead of
  the login message.
- DevHub drops the `npm_config_*` variables of a package manager script
  from the environment of each child. npx warned about each pnpm value,
  and the warnings hid the message of eas-cli.
- The two eas-cli messages say "in a terminal" and "start the sync again",
  because the sync can start from the page.
- `llms.txt` lists the full core API. The list in `0.0.0-alpha.0` did not
  have each exported name.

## [0.0.0-alpha.0] - 2026-10-19

The first alpha. DevHub keeps your EAS dev client builds, installs a stored
build on a device that runs now, and shows the builds and the devices on a
local page. The fingerprint match, the store of local `npx expo run:*`
builds, and the launch of an app are not in this version.

On Windows, no manual run has confirmed that `devhub ui` gives the browser
its token. If the page asks for the token, open the URL that `devhub ui`
prints.

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
  the path of its file. A build that `devhub install` refuses on this
  system also gets `installProblem`: the reason and the fix.
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
- `devhub ui` starts a local server, prints its URL, and opens the DevHub
  page in the browser. The page shows the stored builds of each project
  and the devices that run now, in the light or dark scheme of the system.
  The Install button of a build installs it on the ready device of its
  platform. With two or more ready devices, a menu lists them first. A
  build that `devhub install` refuses shows the reason and the fix. The
  Sync button runs `devhub sync --all`, shows the result of each project,
  and reads the builds again. While another sync runs, it shows the lock
  message.
  The server listens on `127.0.0.1` only. Each run makes a new token, and
  each API call must send it. The API gives the same JSON as `devhub list`,
  `devhub devices`, `devhub install`, and `devhub sync --all` with
  `--json`. It accepts `--port <n>`, `--no-open`, and `--json`.
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
- `llms.txt` in the package, for AI agents. It gives the help of each
  command, the type of each `--json` output, and the names of the core API
  of the installed version.
- The runtime dependencies `cross-spawn` and `json5`. On Windows, `eas` is a
  `.cmd` file, and cross-spawn runs it with each argument escaped, with no
  shell string. json5 reads an `eas.json` with comments, which eas-cli
  accepts.

[unreleased]: https://github.com/rootnative/devhub/compare/devhub@0.0.0-alpha.1...HEAD
[0.0.0-alpha.1]: https://github.com/rootnative/devhub/releases/tag/devhub@0.0.0-alpha.1
[0.0.0-alpha.0]: https://github.com/rootnative/devhub/releases/tag/devhub@0.0.0-alpha.0
