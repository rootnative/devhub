---
title: devhub where
description: Print the path of a stored build file.
---

# devhub where

Prints the path of a stored build file.

```bash
devhub where <id> [options]
```

`<id>` is the build ID, or the start of it. `devhub list` shows a start of
each ID that is unique.

| Option | What it does |
| --- | --- |
| `--json` | Print the ID and the path as JSON. |
| `-h`, `--help` | Show the help. |

## Example

```bash
devhub where 5d1c
```

```text
/Users/me/Library/Application Support/devhub/builds/5d1c9a2e-4b7f-4c1a-9e3d-2f6a8b0c1d2e/trail-5d1c9a2e.apk
```

```bash
devhub where 5d1c --json
```

```json
{
  "id": "5d1c9a2e-4b7f-4c1a-9e3d-2f6a8b0c1d2e",
  "path": "/Users/me/Library/Application Support/devhub/builds/5d1c9a2e-4b7f-4c1a-9e3d-2f6a8b0c1d2e/trail-5d1c9a2e.apk"
}
```

## Use the path

Use the path with another tool, for example to install the build on a
device that `devhub install` does not support:

```bash
adb install -r "$(devhub where 5d1c)"
```

The path can have spaces, so put it in quotes. Do not move or change the
file. The store keeps its SHA-256 hash.

## Errors

Each of these problems gives a message on stderr and exit code `1`:

| Problem | Fix |
| --- | --- |
| No stored build has an ID that starts with `<id>`. | Run `devhub list` to see the stored builds. |
| Two or more builds start with `<id>`. The message lists their IDs. | Give more characters of the ID. |
| The record names a file that does not exist. | The message tells you how to download the build again. |
