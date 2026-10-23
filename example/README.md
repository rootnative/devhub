# DevHub example

An Expo app that tests the build cache provider of DevHub
(`@rootnative/devhub/cache-provider`) with `npx expo run:android` and
`npx expo run:ios`. The app config turns on the provider:

```json
"buildCacheProvider": { "plugin": "@rootnative/devhub/cache-provider" }
```

The app is not a demo. It shows one line of text.

## The store of the example

The scripts of this app keep the builds in `.devhub/` in this folder, not in
your own DevHub store. `with-store.mjs` sets `DEVHUB_HOME` to that folder,
and then starts `expo` or `devhub`. Git ignores the folder. `pnpm clean`
deletes it.

A command that you run with `npx` does not get this setting, and uses your
own store.

## Before the test

1. In the root folder of the repository, run `pnpm install` and
   `pnpm run build`. The app loads the provider from
   `packages/devhub/dist/`. After a change to the package, build it again.
2. For Android, start an emulator, or connect a phone with USB. For iOS,
   start a simulator on a Mac.

## The test

Run each command in this folder.

| Step | Command | Result |
| --- | --- | --- |
| 1 | `pnpm android` | `› DevHub: No stored build has the android fingerprint …`. Gradle builds the app. After the app starts: `› DevHub: Stored the build <id> in the DevHub store.` |
| 2 | `pnpm android` | `› DevHub: Expo CLI installs the stored build <id>, and does not build the app.` Gradle does not run. |
| 3 | Change `orientation` in `app.json` from `portrait` to `default`. Then `pnpm android`. | The fingerprint is new, so Gradle builds the app. The `android` folder is older than `app.json`, so DevHub gives a warning and does not store the build. |
| 4 | Delete the `android` folder. Then `pnpm android`. | Expo CLI runs prebuild, Gradle builds the app, and DevHub stores a second build. |
| 5 | Set `orientation` back to `portrait`. Delete the `android` folder. Then `pnpm android`. | Expo CLI runs prebuild. The fingerprint of step 1 is back, so Expo CLI installs the build of step 1. Gradle does not run. |
| 6 | `pnpm devhub list`, then `pnpm devhub match` | The two local builds of this app. The build of step 1 matches. |

For iOS, use `pnpm ios`, and delete the `ios` folder, in steps 1 to 5.
Xcode builds the app in place of Gradle. Expo CLI uses the provider only for
a simulator, not for an iOS device. Expo SDK 58 needs Xcode 26 for a local
iOS build.

`node gate.mjs android` and `node gate.mjs ios` do steps 1 to 6 with no
person at the device, and check the output and the store after each run.
Each run uses `--no-bundler`, so the app opens with no JavaScript. The
script always puts `app.json` back. The workflow `gate-cache-provider.yml`
runs it on GitHub Actions.

## The native folders

`expo run` makes the `android` and `ios` folders with prebuild in step 1.
Git ignores them, so `@expo/fingerprint` does not read them, and they do not
change the fingerprint.

Expo CLI runs prebuild only when the folder is missing. A change to a native
input in `app.json` therefore does not go into a folder that exists, and
Gradle or Xcode builds the old native code with the new fingerprint. DevHub
does not store such a build (step 3). Delete the folder, or run
`npx expo prebuild --clean`, after each change to the app config.

To give the device, add `--device <name>`, for example
`pnpm android --device Test_AVD_34`. Without `--device`, a stored Android
build must hold the native code of each ready device, because Expo CLI does
not tell the provider which device it uses.
