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
- `devhub sync --all` syncs each project folder that `devhub sync` saw
  before. A project that fails does not stop the others.
- `devhub list` shows the stored builds. `--json` prints each record with
  the path of its file.
- `devhub where <id>` prints the path of a stored build file. `<id>` is the
  EAS build ID, or a unique start of it.
- The store: one folder for all projects, in the data folder of the OS, or
  in `DEVHUB_HOME`. Each build has a folder with its file and a `build.json`
  that keeps the EAS record without changes. A sync writes `build.json`
  last, so an interrupted sync never leaves a record of a broken file. A
  lock stops a second sync while one runs.
- The core API that the CLI uses: `syncProjects`, `scanStore`, `findBuild`,
  `devClientProfiles`, `resolveHome`, and the `eas` command builders.
- The runtime dependencies `cross-spawn` and `json5`. On Windows, `eas` is a
  `.cmd` file, and cross-spawn runs it with each argument escaped, with no
  shell string. json5 reads an `eas.json` with comments, which eas-cli
  accepts.
