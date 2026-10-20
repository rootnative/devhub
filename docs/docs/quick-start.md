---
title: Quick start
description: Keep the EAS dev client builds of a project, and install one on an emulator or a simulator.
---

# Quick start

This page keeps the EAS dev client builds of one project, and installs one
of them on an emulator. It takes a few minutes, and most of that time is
the download.

Before you start, [install DevHub](./installation.md), and log in to
eas-cli with `npx eas-cli login`.

## 1. Sync the project

Go to the project folder, and run the sync:

```bash
cd my-app
devhub sync
```

DevHub reads `eas.json`, finds each build profile with
`"developmentClient": true`, and downloads each finished build of those
profiles that EAS still has:

```text
/Users/me/projects/my-app
  Profiles: development (android, ios), development-simulator (android, ios)
  Downloaded  b8d0f2a4  android        development            1.5.0  214.8 MB
  Downloaded  a7e3b0c4  ios simulator  development-simulator  1.4.0  98.3 MB
  2 downloaded (313.1 MB), 1 build expired before sync.
```

DevHub also remembers the project folder. Later, `devhub sync --all` syncs
each project that it remembers.

## 2. See the stored builds

```bash
devhub list
```

```text
ID        PROJECT  PLATFORM       PROFILE                VERSION  COMMIT   CREATED     EAS EXPIRY
b8d0f2a4  my-app   android        development            1.5.0    8b1f2c3  2026-10-12  2026-11-11
a7e3b0c4  my-app   ios simulator  development-simulator  1.4.0    8b1f2c3  2026-10-12  2026-11-11
```

`EAS EXPIRY` is the date on which EAS deletes its copy. The copy in the
DevHub store stays.

## 3. Start a device

Start an Android emulator from Android Studio, or boot an iOS simulator
from Xcode. DevHub does not start a device. Then check that DevHub sees
it:

```bash
devhub devices
```

```text
ID                                    PLATFORM  KIND       NAME                      STATE
emulator-5554                         android   emulator   Pixel_8_API_35            ready
6F1D2C3B-4A5E-4F60-9A7B-8C9D0E1F2A3B  ios       simulator  iPhone 16 Pro (iOS 18.6)  ready
```

## 4. Install a build

Give the ID from `devhub list`. The start of the ID is sufficient:

```bash
devhub install b8d0
```

```text
Installing the build b8d0f2a4-6c8e-4a0b-9c1d-3e5f7a9b1c3d on Pixel_8_API_35 (emulator-5554).
Installed the build b8d0f2a4-6c8e-4a0b-9c1d-3e5f7a9b1c3d on Pixel_8_API_35 (emulator-5554).
```

## 5. Load your JavaScript

DevHub installs the app, and does not open it. Start Metro in the project
folder:

```bash
npx expo start
```

Press `a` for Android or `i` for iOS. Expo CLI opens the installed dev
client with the URL of Metro.

## 6. Check before the next build

Before you make a new native build, ask DevHub if a stored build already
matches your code:

```bash
devhub match
```

When a build matches, install it, and do not build. See
[`devhub match`](./commands/match.md).

## Next steps

- Open the same functions on a page in your browser with
  [`devhub ui`](./commands/ui.md).
- Store each `npx expo run:*` build with the
  [cache provider](./guides/local-builds.md).
- Keep the builds of all your projects with a
  [daily sync](./guides/daily-sync.md).
