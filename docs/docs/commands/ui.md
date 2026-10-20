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

The page has a devices section and a builds section, with one card for
each project. It reads the devices again when you return to the window,
and when you click Refresh. It does not poll.

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

Click Sync to run `devhub sync --all`. The terminal of `devhub ui` shows
the progress. When the sync ends, the page shows the result of each
project, and reads the builds again.

Only one sync runs at a time. When a sync runs from a terminal or from a
second tab, the page shows that message.

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
