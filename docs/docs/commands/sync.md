---
title: devhub sync
description: Download the EAS dev client builds of a project before EAS deletes them.
---

# devhub sync

Downloads each finished EAS dev client build of the project in the current
folder that the store does not have.

```bash
devhub sync [options]
```

| Option | What it does |
| --- | --- |
| `--all` | Sync each project folder that `devhub sync` saw before. |
| `--profile <name>` | Also sync this build profile. Give it again for each other profile. |
| `--dry-run` | Show what the sync downloads. Download nothing. |
| `--json` | Print the result as JSON. See [JSON output](../reference/json-output.md). |
| `-h`, `--help` | Show the help. |

## Example

```bash
devhub sync
```

```text
/Users/me/projects/my-app
  Profiles: development (android, ios), development-simulator (android, ios)
  Downloaded  b8d0f2a4  android  development  1.5.0  214.8 MB
  1 downloaded (214.8 MB), 1 already stored, 1 build expired before sync.
```

The progress lines, for example `Downloading the build …`, go to stderr.

## Which builds DevHub keeps

DevHub reads `eas.json` and syncs each build profile with
`"developmentClient": true`. It reads the file the same as eas-cli:

- It follows `extends`, so a profile can get `developmentClient` from
  another profile.
- It reads the `android` and `ios` blocks. A profile that is a dev client
  only on iOS gives only its iOS builds.
- It accepts comments and trailing commas in `eas.json`.

`--profile <name>` adds a profile that is not a dev client profile, for
both platforms. When `eas.json` has no dev client profile and you give no
`--profile`, the sync of the project fails, and tells you how to fix it.

DevHub looks for `eas.json` in the current folder, and then in each parent
folder. So you can run the sync from a folder inside the project.

DevHub keeps each type of build file:

| File | Build |
| --- | --- |
| `.apk` | Android |
| `.aab` | Android App Bundle. DevHub keeps it, but cannot install it. |
| `.tar.gz` | iOS simulator build |
| `.ipa` | iOS device build. DevHub keeps it, but cannot install it. |

An `.ipa` cannot install after its provisioning profile expires, but it
stays in your build history.

:::note

A dev client is a debug build. Its JavaScript runs in development mode, so
it does not show the real speed of your app in production.

:::

## The result of each build

The text output lists only the builds that changed or failed. Stored and
expired builds show as a count, because they repeat on each daily sync.
`--json` lists each build.

| Status | Meaning |
| --- | --- |
| `Downloaded` | DevHub downloaded the build, and stored it. |
| `Would download` | A dry run. DevHub downloads this build on the next sync. |
| `Stored` | The store already has the build. |
| `Expired` | EAS deleted the build before the first sync. DevHub cannot get it back. |
| `No file` | EAS has no file for the build. |
| `Invalid ID` | The build ID from EAS is not a valid folder name. DevHub skipped it. |
| `Failed` | The download failed. The next sync tries again. |

A [daily sync](../guides/daily-sync.md) prevents an expired build: it
downloads each new build before EAS deletes it.

## How DevHub runs eas-cli

DevHub runs `eas whoami` first, to find eas-cli and to check the login:

1. DevHub runs `eas` when it is on your `PATH`.
2. When `eas` is not on your `PATH`, DevHub runs `npx --yes eas-cli`. npx
   uses the eas-cli of the project when the project has one.
3. When eas-cli has no login, DevHub stops, and gives the command to run.

Then DevHub runs `eas build:list --json --non-interactive --status finished`
for each profile. It downloads each file from the URL in the EAS record.
DevHub never reads, asks for, or stores a token.

## Sync all your projects

Each sync that is not a dry run records the project folder in the store.
Then `devhub sync --all` syncs each of these projects, from any folder:

```bash
devhub sync --all
```

Run it once a day, so you keep the builds of the projects that you do not
work on now. See [Sync every day](../guides/daily-sync.md).

- A project folder that does not exist anymore gets a warning, and the
  sync skips it.
- A project that fails does not stop the other projects.

## One sync at a time

Two syncs cannot run at the same time, because each sync removes the
incomplete build folders. When a sync starts while another sync runs, it
stops with a message that names the process of the first sync. When a
sync stops before its end, for example after a crash, the next sync
takes its place, and downloads the incomplete builds again. A dry run
changes nothing, so it can run while another sync runs.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Each project synced. |
| `1` | A project failed, eas-cli did not start, or another sync runs now. |
| `2` | A usage error, for example an unknown option. |
