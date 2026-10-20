---
id: index
title: Introduction
slug: /introduction
description: DevHub by Root Native keeps every Expo development build on your machine, finds the build that matches your code, and installs it on a simulator or an emulator.
---

# DevHub by Root Native

**Keep every dev build. Launch any one in one click.**

DevHub is a CLI and a local web page for Expo developers. It keeps every
development build on your machine, finds the build that matches your
current code by its native fingerprint, and installs that build on a
simulator, an emulator, or an Android phone.

```bash
npx @rootnative/devhub list
```

## Why DevHub

Expo recommends a development build in place of Expo Go. When you work on
many Expo projects, you get these problems:

- Each project needs its own dev client for each platform.
- EAS deletes old builds after a retention period.
- A native build takes minutes, but most of the time the native code did
  not change, and the old build still works.
- Nothing shows which builds you have, and which one matches your branch.

A dev client needs a new build only when the native fingerprint changes.
DevHub stores each build with its fingerprint. When your code matches a
stored build, you use that build, and you do not build again.

## What DevHub does

| Task | Command |
| --- | --- |
| Download your EAS dev client builds before EAS deletes them. | [`devhub sync`](./commands/sync.md) |
| Show the builds of all your projects in one list. | [`devhub list`](./commands/list.md) |
| Give the path of a stored build file. | [`devhub where`](./commands/where.md) |
| Show the emulators, phones, and simulators that can get a build. | [`devhub devices`](./commands/devices.md) |
| Install a stored build on a device that runs now. | [`devhub install`](./commands/install.md) |
| Find the stored builds that match the native code of a project. | [`devhub match`](./commands/match.md) |
| Show the builds and the devices on a page, with an install button. | [`devhub ui`](./commands/ui.md) |
| Show the EAS login state that a sync needs. | [`devhub whoami`](./commands/whoami.md) |
| Check the tools and the store that DevHub uses, with the fix for each problem. | [`devhub doctor`](./commands/doctor.md) |
| Store each `npx expo run:*` build, and use it again on the next run. | [The cache provider](./guides/local-builds.md) |

## How it works

DevHub keeps one [store](./guides/store.md) for all your projects. A build
gets into the store in two ways:

- `devhub sync` downloads the finished EAS builds of each dev client
  profile in `eas.json`.
- The Expo build cache provider copies each build that
  `npx expo run:android` or `npx expo run:ios` makes on your machine.

Each build keeps its native fingerprint. `devhub match` calculates the
fingerprint of your current code with the `@expo/fingerprint` of your
project, the same as EAS does. A stored build with the same fingerprint
runs your current JavaScript, so you install it and do not build again.

## Platforms

| Host | Android emulators and phones | iOS simulators |
| --- | --- | --- |
| macOS | Yes | Yes |
| Windows | Yes | No |
| Linux | Yes | No |

DevHub installs an iOS build on a simulator only. It does not install on
an iPhone.

## What DevHub does not do

- DevHub sends no telemetry. It uses the network only for `devhub sync`.
  See [Security and privacy](./reference/security.md).
- DevHub never uninstalls an app, because an uninstall deletes the app
  data. When an install needs an uninstall, DevHub gives you the command.
- DevHub does not change your project. The cache provider is the only
  part that you add to a project, and you add it yourself.

## Next steps

1. [Install DevHub](./installation.md).
2. Follow the [quick start](./quick-start.md).
