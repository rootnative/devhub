---
title: devhub match
description: Find the stored builds that match the native code of your project, so you do not build again.
---

# devhub match

Finds the stored builds that match the native code of the project in the
current folder. A build that matches needs no new build: install it with
`devhub install <id>`.

```bash
devhub match [options]
```

| Option | What it does |
| --- | --- |
| `--platform <name>` | Only this platform: `android` or `ios`. Give it again for the other one. The default is both. |
| `--json` | Print the result as JSON, with the full record of each match. See [JSON output](../reference/json-output.md). |
| `-h`, `--help` | Show the help. |

## Example

```text
Project: /Users/me/projects/trail-app (@expo/fingerprint 0.20.13)

android  3f2a0c9e1b7d4a6f8e2c5b1d9a7f3e6c4b8d2a1f
  ID        PLATFORM  PROFILE      VERSION  COMMIT   CREATED     EAS EXPIRY
  5d1c9a2e  android   development  1.4.0    8b1f2c3  2026-10-12  2026-11-11

ios  9c1b7e4d2a6f0c3e8b5d1a7f4e2c9b6d3a8f1e5c
  No stored build matches this fingerprint.
```

Here the Android build `5d1c9a2e` runs the current code. The iOS app needs
a new build.

## How the match works

A dev client needs a new build only when the native fingerprint changes.
The fingerprint is a hash of each native input of the project: the native
dependencies, the app config, and the `android` and `ios` folders when
git tracks them.

DevHub runs the `@expo/fingerprint` of your project, with the same options
as eas-cli, one time for each platform. Then it compares each hash with
the fingerprint of each stored build. It uses the copy of
`@expo/fingerprint` in your project, and your `fingerprint.config.js`,
because a different copy can calculate a different hash.

`devhub match` runs no `eas` command, and uses no network.

## Requirements

- Run the command in the project folder, or in a folder inside it. The
  project folder is the nearest folder with a `package.json`, the same as
  for Expo CLI and eas-cli. In a monorepo, run it in the app folder.
- Install the dependencies of the project first.
- The project needs Expo SDK 52 or later, which ships `expo/fingerprint`.

When `@expo/fingerprint` finds no native inputs in the project, DevHub
stops. Such a hash is the same for each project with no native inputs, so
it can match the build of a different app.

## Use it in a script

The exit code is `1` when no stored build matches. A script can then make
a new build only when it is necessary:

```bash
devhub match --platform android || eas build --profile development --platform android
```

Give one `--platform` in a script. With both platforms, the exit code is
`0` when one platform matches and the other does not.

## When a build does not match

Compare the hash with the fingerprint on the EAS build page. These changes
give a different hash:

- A different version of `@expo/fingerprint` in the project.
- A change to a native input, for example a new native dependency or a
  change to the app config.
- An `env` value of the build profile that changes the app config. DevHub
  applies no `env` of a build profile.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | A stored build matches on one or more platforms. |
| `1` | No stored build matches on any platform, or DevHub cannot calculate the fingerprint. |
| `2` | A usage error, for example an unknown platform. |
