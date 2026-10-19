# Security policy

## Supported versions

DevHub is before `1.0.0`. Only the latest release gets security fixes.

| Version | Supported |
| --- | --- |
| `@rootnative/devhub`, latest release | Yes |
| Older releases | No |

## Report a vulnerability

Do not open a public issue for a security problem.

1. Open the [Security tab](https://github.com/rootnative/devhub/security/advisories/new) of this repository.
2. Select **Report a vulnerability** and fill in the private form.
3. Give the affected version and the steps to reproduce the problem.

We reply in 7 days or less. We publish a fix and an advisory after we confirm the report.

## Scope

DevHub runs on the developer's machine. It reads build files, runs `adb`, `emulator`, `xcrun`, `eas-cli`, and `bundletool`, and installs app binaries on simulators and emulators. These reports are in scope:

- A build file or a download that writes outside the DevHub store, for example through a path in an archive.
- A value from a build file, a project config, or an EAS record that changes a command DevHub runs.
- A download that DevHub installs without a check of its SHA-256 hash.
- A credential, such as an EAS token, that DevHub writes to a log or to its store.

The apps that you install with DevHub are out of scope. DevHub does not check what an app does.
