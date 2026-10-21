---
title: devhub ui
description: Open a local page that shows your stored builds and devices, with an install button and a sync button.
---

# devhub ui

Starts a local server, and opens the DevHub page in your browser. The page
shows the stored builds of each project and the devices that run now. It
installs a build with one click, and syncs each project.

```bash
devhub ui [options]
```

| Option | What it does |
| --- | --- |
| `--port <n>` | The port of the server. The default is a free port. |
| `--no-open` | Print the URL, and do not open the browser. |
| `--json` | Print the URL and the port as JSON. The server then runs until Ctrl+C. |
| `-h`, `--help` | Show the help. |

Press Ctrl+C to stop the server. When a sync or an install runs, the
server stops after it ends. Press Ctrl+C again to stop the server at once.

## The page

The app bar shows the store folder under the title. On its right are the
EAS login state, Sync, and Refresh. In a narrow window, the EAS login state
and Sync are above the sections.

The page has a builds section, with one card for each project, and a
devices section and a setup section. In a wide window, the devices and
the setup are in a column next to the builds. Otherwise they are under
the builds. The page reads the devices again when you return to the
window, and when you click Refresh. It does not poll.

In a wide window, each project card is a table with one row for each
build: the ID, the platform, the profile, the version, the commit, the
date, the EAS expiry, the fingerprint, and the size. The fingerprint
column shows the start of the native fingerprint hash. Put the pointer on
it to see the full hash. Builds with the same hash have the same native
code. An expiry date in the past has a line through it: EAS deleted its
copy, and the copy in the store stays. In a narrow window, each build
shows the same values on more than one line.

### Install a build

Click Install on a build to install it on the ready device of its
platform. When two or more devices are ready, select the device in the
menu.

- The button is off when no device of the platform is ready.
- A build that `devhub install` refuses has no button. The page shows the
  reason and the fix.
- When an install fails, the page shows the same message as the CLI, as
  text that you can copy.

Only one install runs at a time.

### Sync

The chip in the app bar shows the EAS login state of
[`devhub whoami`](./whoami.md): signed in with the user name, not signed
in, eas-cli not installed, or the check failed. The page runs that check
when it opens, on Refresh, and after a sync that eas-cli refused. Without
a login, the Sync button is off, and its tooltip gives the fix: the
`eas login` command to run in a terminal. The builds and the install need
no login.

Click Sync to run `devhub sync --all`. The terminal of `devhub ui` shows
the progress. When the sync ends, the page shows the result of each
project, and reads the builds again.

Only one sync runs at a time. When a sync runs from a terminal or from a
second tab, the page shows that message.

### Setup

Click Check in the Setup section to run the checks of
[`devhub doctor`](./doctor.md): Node, the store, eas-cli and its login,
adb, and on macOS Xcode. The page shows one chip for each check, with its
state. Put the pointer on a chip to see what DevHub found. The fix of each
warning and failure is under the chips. The page runs the checks only on a
click, because the EAS check can use the network. Click Check again after
a fix.

## Security

- The server listens on `127.0.0.1` only, never on your network.
- Each run makes a new token, and puts it in the URL after `#token=`. A
  browser does not send this part of the URL to a server, so the token is
  not in a log. Each API call must send the token, so a different page in
  your browser cannot use the API.
- Open the URL that `devhub ui` prints. A URL with `localhost` does not
  work, because the server accepts only the host `127.0.0.1`.
- The page loads nothing from the network: no font, no script, and no
  image.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | The server stopped after Ctrl+C. |
| `1` | The server did not start, for example because the port is in use. |
| `2` | A usage error, for example a port that is not a number. |
