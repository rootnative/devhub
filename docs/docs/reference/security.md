---
title: Security and privacy
description: What DevHub sends over the network, what it changes on your machine, and how to report a vulnerability.
---

# Security and privacy

DevHub runs on your machine. It reads build files, runs `adb`, `xcrun`,
and `eas`, and installs apps on simulators, emulators, and Android
devices.

## Network

DevHub sends no telemetry.

| Command | Network |
| --- | --- |
| `devhub sync` | Runs eas-cli, which calls EAS. Downloads each build file from the URL in its EAS record. |
| `devhub ui` | A server on `127.0.0.1` only. A click on Sync uses the network, the same as `devhub sync`. |
| Each other command, and the cache provider | None. |

## Credentials

DevHub uses the login of eas-cli. It never reads, asks for, or stores a
token.

## What DevHub changes

- **Apps.** DevHub installs an app, and replaces an installed app with the
  same app ID. It never uninstalls an app, because an uninstall deletes
  the app data. When an install needs an uninstall, DevHub prints the
  command, and you decide.
- **Builds.** A sync deletes only a build folder with no `build.json`: an
  incomplete download. DevHub never deletes a stored build.
- **Projects.** DevHub does not change a project. You add the cache
  provider to the app config yourself.

## Commands that DevHub runs

DevHub runs each tool with a list of arguments, never with a shell string.
A path, an app ID, or a build ID with a space or a quote cannot change the
command.

## The local page

The page of [`devhub ui`](../commands/ui.md) listens on `127.0.0.1` only.
Each run makes a new token, and each API call must send it. The server
accepts only the host `127.0.0.1`, and only a `POST` from its own page. The
page loads nothing from the network.

## Report a vulnerability

Do not open a public issue for a security problem.

1. Open the
   [Security tab](https://github.com/rootnative/devhub/security/advisories/new)
   of the repository.
2. Select **Report a vulnerability**, and fill in the private form.
3. Give the affected version and the steps to reproduce the problem.

We reply in 7 days or less. We publish a fix and an advisory after we
confirm the report. Only the latest release gets security fixes.

These reports are in scope:

- A build file or a download that writes outside the DevHub store, for
  example through a path in an archive.
- A value from a build file, a project config, or an EAS record that
  changes a command that DevHub runs.
- A download that DevHub installs without a check of its SHA-256 hash.
- A credential, such as an EAS token, that DevHub writes to a log or to
  its store.

The apps that you install with DevHub are out of scope. DevHub does not
check what an app does.
