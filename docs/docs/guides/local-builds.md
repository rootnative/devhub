---
title: Keep your local builds
description: Use DevHub as the Expo build cache provider, so npx expo run stores each build and installs a stored build when the native code did not change.
---

# Keep your local builds

DevHub is also an Expo build cache provider. With it,
`npx expo run:android` and `npx expo run:ios` store each new build in the
DevHub store. The next run with the same native code installs the stored
build, and Gradle or Xcode does not run.

## Set it up

1. Add DevHub to the project as a dev dependency. Expo CLI loads the
   provider from the project folder, not from a global install.

   ```bash
   npm install --save-dev @rootnative/devhub
   ```

2. Add the provider to the app config (`app.json` or `app.config.js`):

   ```json
   {
     "expo": {
       "buildCacheProvider": { "plugin": "@rootnative/devhub/cache-provider" }
     }
   }
   ```

   Expo SDK 53 reads the key under `expo.experiments`.

3. Run the app as usual:

   ```bash
   npx expo run:android
   ```

The first run builds the app, and DevHub stores the APK. The next run with
the same native code installs the stored APK. iOS works the same for a
simulator.

## What you see

The provider writes its lines in the output of Expo CLI, with the prefix
`› DevHub:`. When it has nothing to say, it writes nothing.

## When a stored build serves a run

A stored build serves a run when all of these agree:

- **The fingerprint of the platform.** DevHub calculates it with the
  `@expo/fingerprint` of the project, the same as
  [`devhub match`](../commands/match.md).
- **The variant.** The Android `--variant` (default `debug`), or the iOS
  `--configuration` (default `Debug`).
- **Android: the native code.** A debug build of `npx expo run:android`
  holds only the ABI of the device that it was made for. So the APK must
  have native code for each ready device. With `--device <name>`, DevHub
  checks only that device. With `--all-arch`, the APK must hold all four
  ABIs.
- **iOS: the Mac.** A Mac with the same architecture made the build.

The newest build that fits wins. The project folder is not part of the
match, so two clones of one project share their builds.

When DevHub is not sure that a stored build fits, Expo CLI builds the app.
A wrong build is worse than a new build.

## Limits

- Expo CLI uses a build cache provider only for `npx expo run:*`, and on
  iOS only for a simulator. It does not use it for an iOS device.
- `--binary` turns the provider off for one run.
- DevHub does not use or store a build of a run with `--scheme`.
- Only builds that `npx expo run:*` made serve a run. A build that
  `devhub sync` downloaded from EAS does not.
- The provider uses no network, never uninstalls an app, and never
  deletes a build.
- When DevHub cannot read or write the store, it gives a warning, and the
  run continues.

## After a change to the app config

In a managed project, git ignores the `android` and `ios` folders, and the
fingerprint does not read them. Expo CLI runs prebuild only when the
folder is missing. So after a change to the app config,
`npx expo run:*` builds the old native code with the new fingerprint.

DevHub does not store such a build. When `app.json` or `app.config.*` is
newer than the last prebuild, it gives a warning. To fix it, do one of
these:

- Delete the `android` or `ios` folder, and run again.
- Run `npx expo prebuild --clean`, and run again.

## See the local builds

`devhub list` shows a local build with the profile `local` and its
variant, for example `local debug`. `devhub match` shows it as a match,
and `devhub install` installs it the same as an EAS build.
