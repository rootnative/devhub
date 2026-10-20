---
title: JSON output and exit codes
description: Read the output of each devhub command in a script, with --json and the exit codes.
---

# JSON output and exit codes

Each command accepts `--json`. A script, a tool, and an AI agent can read
the same output.

- With `--json`, stdout holds one JSON value and nothing else.
- Progress lines and warnings go to stderr, also without `--json`.
- Each path is absolute. Each date is an ISO 8601 string.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success. |
| `1` | A failure. stdout is empty, and stderr holds the message with the fix. |
| `2` | A usage error, for example an unknown option or a missing argument. |

These commands print their JSON and also exit with `1`:

| Command | When |
| --- | --- |
| `devhub sync --json` | A project failed. The JSON shows which one. |
| `devhub devices --json` | Each device tool failed. The JSON has the warnings. |
| `devhub match --json` | No stored build matches. |
| `devhub whoami --json` | eas-cli has no login, or does not run. |
| `devhub doctor --json` | A check has the status `fail`. |

## The output of each command

| Command | Prints |
| --- | --- |
| `devhub sync --json` | `SyncReport`: `dryRun`, and for each project its `status`, its `profiles`, its `builds` with the result of each build, and its `warnings`. |
| `devhub list --json` | `BuildList`: `builds`, `incomplete`, and `unreadable`. |
| `devhub where <id> --json` | `{ "id": string, "path": string }` |
| `devhub devices --json` | `DeviceReport`: `devices` and `warnings`. |
| `devhub install <id> --json` | `InstalledBuild`: `id`, `path`, and the `device`. |
| `devhub match --json` | `MatchReport`: `project`, `fingerprintVersion`, and for each platform its `hash` and its `matches`. |
| `devhub ui --json` | `{ "url": string, "port": number }`. The server then runs until Ctrl+C. |
| `devhub whoami --json` | `WhoamiReport`: `state`, `cli`, and `user` or `message`. |
| `devhub doctor --json` | `DoctorReport`: `checks`, and for each check its `id`, `label`, `status`, `detail`, and `fix`. |

The full TypeScript types of each output are in
[`llms.txt`](https://rootnative.github.io/devhub/llms.txt).

## A build in the list

Each build in `devhub list --json` and in the matches of
`devhub match --json` has these fields:

| Field | Value |
| --- | --- |
| `id` | The full build ID. |
| `source` | `"eas"` for a build that `devhub sync` downloaded, or `"local"` for a build that `npx expo run:*` made. |
| `path` | The absolute path of the build file. |
| `size` | The size of the file, in bytes. |
| `sha256` | The SHA-256 hash of the file. |
| `storedAt` | The date on which DevHub stored the build. |
| `installProblem` | Why `devhub install` refuses the build on this system, with the fix. Absent when it can install the build. |
| `eas` | An EAS build: the record of `eas build:list --json` with no change. |
| `local` | A local build: the platform, the fingerprint, the variant, the project folder, and the app values. |

eas-cli drops each field with a `null` value, so an absent field in `eas`
means "no value". The `eas` record can have more fields than the types
name.

## A device

```json
{
  "platform": "android",
  "kind": "physical",
  "id": "R5CT21ABCDE",
  "name": "R5CT21ABCDE",
  "state": "unauthorized",
  "ready": false,
  "problem": "Unlock the device, and accept the USB debugging prompt on it."
}
```

| Field | Value |
| --- | --- |
| `platform` | `"android"` or `"ios"`. |
| `kind` | `"emulator"`, `"physical"`, or `"simulator"`. |
| `id` | The adb serial, or the simulator UDID. |
| `state` | The state as the device tool prints it. |
| `ready` | `true` when DevHub can install a build on the device now. |
| `problem` | Why DevHub cannot install on the device now, and the fix. |
| `osVersion` | The iOS version of a simulator. |

## Example: install the newest Android build of a project

```bash
id=$(devhub list --json | jq -r '[.builds[] | select(.source == "eas" and .eas.platform == "ANDROID" and .eas.app.slug == "trail-app" and (has("installProblem") | not))][0].id')
devhub install "$id" --json
```

`devhub list` sorts the builds of each project newest first, so the first
build that fits is the newest one.
