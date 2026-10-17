# RootNative DevHub

[![Node >=20.19](https://img.shields.io/badge/node-%3E%3D20.19-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm 10](https://img.shields.io/badge/pnpm-10.x-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Turborepo](https://img.shields.io/badge/monorepo-turbo-EF4444)](https://turbo.build/)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Keep every dev build. Launch any one in one click.**

RootNative DevHub is a desktop app and a CLI for Expo developers. It keeps
every development build on your machine, finds the build that matches your
current code, and starts a simulator or an emulator with that build in one
action.

> **Status:** Milestone 1, "Keep". `devhub sync`, `devhub list`, and
> `devhub where` keep your EAS dev client builds. The other features below
> are the plan. Nothing is on npm yet. The
> [package README](packages/devhub/README.md) shows how to use the CLI.

## Why

Expo recommends a development build in place of Expo Go. When you work on
many Expo projects, you get these problems:

- Each project needs its own dev client for each platform.
- EAS deletes old builds after a retention period.
- A native build takes minutes, but most of the time the native code did not
  change, and the old build still works.
- Nothing shows which builds you have, and which one matches your branch.

A dev client needs a rebuild only when the native fingerprint changes.
DevHub stores each build with its fingerprint. When your code matches a
stored build, DevHub uses that build, and you do not build again.

## What it will do

- **Store** every dev build and release build, for all your projects, in one
  local library.
- **Save builds automatically** from `npx expo run:android` and
  `npx expo run:ios`, through the Expo build cache provider.
- **Download your EAS builds** before EAS deletes them.
- **Import** an `.apk`, `.aab`, or `.app` file.
- **Match** the current code of a project to a stored build by fingerprint.
- **Launch** a build on a simulator or an emulator in one action: boot,
  install, and open with Metro, an EAS Update, or nothing.
- **Save launch profiles** for the device and build combinations you use
  often.
- **Prune** old builds by rules that you set.

Android works on macOS, Windows, and Linux. iOS works on macOS.

## Development

```bash
pnpm install
pnpm run build
pnpm run typecheck
pnpm run test
pnpm run lint
```

## Roadmap

DevHub grows in small milestones. Each one gives you one useful result.

1. **Keep:** `devhub sync` downloads your EAS dev client builds before EAS
   deletes them. `devhub list` shows them, and `devhub where` gives the path
   of a file.
2. **Install:** install a stored build on a running emulator, simulator, or
   Android phone.
3. **Match:** see the stored build that matches your current code.
4. **Local builds:** `npx expo run:*` stores each build and uses a stored
   build again.
5. **Desktop:** a desktop app with the list, a daily sync, and an install
   button.

## License

[MIT](LICENSE)
