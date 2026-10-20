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

Android works on macOS, Windows, and Linux. iOS simulators work on macOS
only.
