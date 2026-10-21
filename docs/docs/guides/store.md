---
title: The store
description: Where DevHub keeps your builds, how to move the store, and what each folder holds.
---

# The store

The store is one folder for the builds of all your projects. It is never
inside a project folder.

| System | Folder |
| --- | --- |
| macOS | `~/Library/Application Support/devhub` |
| Windows | `%LOCALAPPDATA%\devhub` |
| Linux | `$XDG_DATA_HOME/devhub`, or `~/.local/share/devhub` |

## Use a different folder

Set `DEVHUB_HOME` to use a different folder, for example on an external
disk:

```bash
export DEVHUB_HOME=/Volumes/External/devhub
```

A dev client build can be more than 100 MB, so the store grows fast. Each
command, and each scheduled job, must get the same `DEVHUB_HOME`. A
scheduled job does not read your shell profile, so set the variable in
the job too.

To see the folder that a command uses, run `devhub list`. Its first line
names the store folder. `devhub doctor` and the `devhub ui` page show it
too.

## What the store holds

```text
<DEVHUB_HOME>/
  projects.json            each project folder that devhub sync saw
  sync.lock                the process ID of the sync that runs now
  builds/<id>/             the EAS build ID, or a UUID for a local build
    build.json             the record. A folder without it is incomplete.
    <file>                 .apk, .aab, .tar.gz (iOS simulator), or .ipa
  extracted/<id>/          the unpacked iOS simulator build, a cache
```

- `build.json` holds the record of the build: for an EAS build, the
  record of `eas build:list --json` with no change, and the size and the
  SHA-256 hash of the file.
- The `extracted` folder holds the unpacked iOS simulator builds. You can
  delete it at any time. The next install unpacks the build again.
- `sync.lock` exists only while a sync runs.

Read the store with the CLI, for example with
[`devhub list --json`](../commands/list.md). Do not write into it, and do
not move or change a build file.

## Delete a build

DevHub has no command that deletes a build. To delete a build, delete its
folder in `builds/`, and its folder in `extracted/` if it has one. Delete
a folder only when no sync runs. When EAS still has the build, the next
sync downloads it again.
