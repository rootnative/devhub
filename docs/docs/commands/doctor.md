---
title: devhub doctor
description: Check the tools and the store that DevHub uses, and get the fix for each problem.
---

# devhub doctor

Checks the tools and the store that DevHub uses on this machine, and gives
the fix for each problem. Run it after the install, and when a command
fails for a reason that is not clear.

```bash
devhub doctor [options]
```

| Option | What it does |
| --- | --- |
| `--json` | Print the report as JSON. See [JSON output](../reference/json-output.md). |
| `-h`, `--help` | Show the help. |

## Example

```text
DevHub 0.0.0-alpha.1

ok    Node     Node 24.11.0
ok    Store    /Users/ana/Library/Application Support/devhub, 12 builds
warn  EAS      Not signed in (npx --yes eas-cli)
               eas-cli has no login. Run "npx --yes eas-cli login" in a terminal, and then start the sync again.
ok    Android  Platform-Tools 36.0.0, /Users/ana/Library/Android/sdk/platform-tools/adb
ok    iOS      Xcode 26.0.1

1 warning. The other features work. Do the fix above for the features that you use.
```

## The checks

The checks look at the machine, not at a project. They do not read the
current folder.

| Check | What DevHub does | Necessary for |
| --- | --- | --- |
| Node | Reads the version of the Node that runs DevHub. It must be 20.19 or later. | Each command. |
| Store | Finds the [store](../guides/store.md) folder, checks that DevHub can write to it, and counts the builds. The line says when `DEVHUB_HOME` sets the folder. | Each command. |
| EAS | Runs `eas whoami`, the same as [`devhub whoami`](./whoami.md). | `devhub sync`. |
| Android | Runs `adb version` with the adb that `devhub devices` uses. | Android devices. |
| iOS | Runs `xcodebuild -version`, on macOS only. It fails when `xcode-select` points at the Command Line Tools and not at Xcode. | iOS simulators. |

The EAS check is the only check that can use the network. The first
`npx --yes eas-cli` on a machine downloads eas-cli, so the first run can
take a while.

## The states

| `status` | Meaning |
| --- | --- |
| `ok` | The check passed. |
| `warn` | One feature does not work, for example the iOS installs. The other features work. |
| `fail` | No feature works until you do the fix. |
| `skip` | The check does not apply to this system, for example the iOS check on Windows and Linux. |

A `warn` and a `fail` give the fix below the line. The exit code is `1`
when a check is `fail`, and `0` otherwise. A warning gives `0`, because a
developer who builds for Android only does not need Xcode.
