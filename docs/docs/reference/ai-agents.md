---
title: For AI agents
description: Give an AI coding agent the exact DevHub API with llms.txt.
---

# For AI agents

DevHub ships `llms.txt`: one file that gives an AI agent the help of each
command, the type of each `--json` output, the store layout, the rules of
the cache provider, and the rules for an agent.

| Where | When to use it |
| --- | --- |
| `node_modules/@rootnative/devhub/llms.txt` | DevHub is a dependency of the project. This file describes the installed version, so prefer it. |
| [`https://rootnative.github.io/devhub/llms.txt`](https://rootnative.github.io/devhub/llms.txt) | DevHub is not installed in the project, for example when you use it globally or with `npx`. |

## Rules for an agent

- Add `--json` to each command. Then stdout holds one JSON value, and
  nothing else. See [JSON output and exit codes](./json-output.md).
- Give a build ID from `devhub list --json`, and a device ID from
  `devhub devices --json`.
- `devhub install` does not start a device, and does not open the app.
  Start the emulator or the simulator first. Then run `npx expo start`, and
  press `a` or `i`, to load the JavaScript.
- When two or more devices of the build's platform are ready,
  `devhub install` stops with exit code `2`. Give `--device <id>`.
- DevHub never uninstalls an app. For a signing key conflict, it prints
  the `adb uninstall` command and stops. An uninstall deletes the app
  data, so ask the user before you run that command.
- Run `devhub match` before a native build. When a stored build matches,
  install it, and do not build.
- `devhub ui` runs until Ctrl+C. To read data, use the commands with
  `--json`, not the page.
- Do not write into the store folder. Read it with the CLI.

## Tell your agent about DevHub

Add these lines to the instruction file of your agent, for example
`AGENTS.md` in the project:

```md
## DevHub

This project uses DevHub by Root Native (`@rootnative/devhub`) to keep
and install Expo development builds. Before you run a `devhub` command,
read `node_modules/@rootnative/devhub/llms.txt`, or
https://rootnative.github.io/devhub/llms.txt when the package is not
installed. Add `--json` to each `devhub` command. Run `devhub match`
before a native build.
```
