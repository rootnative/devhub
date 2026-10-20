---
title: devhub list
description: Show the builds in the DevHub store, for all your projects.
---

# devhub list

Shows the builds in the store, for all your projects. The list is sorted by
project, and then newest first.

```bash
devhub list [options]
```

| Option | What it does |
| --- | --- |
| `--json` | Print the builds as JSON. See [JSON output](../reference/json-output.md). |
| `-h`, `--help` | Show the help. |

## Example

```text
ID        PROJECT    PLATFORM       PROFILE                VERSION  COMMIT   CREATED     EAS EXPIRY
3c9f6d21  notes      android        development            0.9.2    c41d9e0  2026-10-04  2026-11-03
e2b4c6d8  trail-app  android        local debug            1.4.0    f00dbab  2026-10-19  -
5d1c9a2e  trail-app  android        development            1.4.0    8b1f2c3  2026-10-12  2026-11-11
a7e3b0c4  trail-app  ios simulator  development-simulator  1.4.0    8b1f2c3  2026-10-12  2026-11-11
```

## The columns

| Column | Value |
| --- | --- |
| `ID` | The start of the build ID. It is 8 characters, or more when 8 characters do not make each ID in the list unique. Give it to `devhub where` and `devhub install`. |
| `PROJECT` | The `slug` of the app. |
| `PLATFORM` | `android`, `ios simulator`, or `ios device`. |
| `PROFILE` | The EAS build profile. A local build shows `local` and its variant, for example `local debug`. |
| `VERSION` | The app version. |
| `COMMIT` | The start of the git commit of the build. |
| `CREATED` | The date of the EAS build. For a local build, the date on which DevHub stored it. |
| `EAS EXPIRY` | The date on which EAS deletes its copy. The copy in the store stays. A local build has no EAS copy, so it shows `-`. |

## Local builds

A build with the profile `local` is a build that `npx expo run:android` or
`npx expo run:ios` made on your machine. The
[cache provider](../guides/local-builds.md) stored it. Its ID is a UUID
that DevHub made. `devhub where`, `devhub install`, and `devhub match`
accept it the same as an EAS build.

## Problems in the store

A build folder with no `build.json` is incomplete, for example after a
sync stopped during a download. `devhub list` gives a note on stderr, and
the next sync replaces the folder.

A `build.json` that DevHub cannot read, for example one that a newer
DevHub wrote, gets a warning on stderr with the reason. A sync never
replaces such a folder.

In `--json`, these folders are in `incomplete` and `unreadable`.
