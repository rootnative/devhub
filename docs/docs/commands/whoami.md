---
title: devhub whoami
description: Show the EAS login state that a sync needs.
---

# devhub whoami

Shows the EAS login state. DevHub runs `eas whoami` with `eas` on `PATH`,
or else with `npx --yes eas-cli`, the same as the sync does before it reads
the builds. A sync needs a login. The other commands do not: the stored
builds, the devices, and an install work with no login and no eas-cli.

```bash
devhub whoami [options]
```

| Option | What it does |
| --- | --- |
| `--json` | Print the state as JSON. See [JSON output](../reference/json-output.md). |
| `-h`, `--help` | Show the help. |

## Example

```text
Signed in to EAS as someone (npx --yes eas-cli).
```

The exit code is `0` with a login, and `1` without one. Without a login,
the message with the fix goes to stderr:

```text
eas-cli has no login. Run "npx --yes eas-cli login" in a terminal, and then start the sync again.
```

## The states

| `state` | Meaning | `message` |
| --- | --- | --- |
| `signed-in` | eas-cli runs and has a login. `user` is the EAS user name. | None. |
| `signed-out` | eas-cli runs and has no login. | The `eas login` command to run in a terminal. |
| `no-cli` | Neither `eas` nor `npx` starts. | Put `eas` or `npx` on `PATH`. |
| `failed` | eas-cli started and failed for another reason, for example no network. | The command, its exit code, and the end of its output. |

`cli` says how DevHub starts eas-cli: `eas` on `PATH`, `npx`, or `none`.

The page of [`devhub ui`](./ui.md) shows this state under its title, and
disables the Sync button while the state is not `signed-in`. The first
`npx --yes eas-cli` on a machine downloads eas-cli, so the first check can
take a while.
