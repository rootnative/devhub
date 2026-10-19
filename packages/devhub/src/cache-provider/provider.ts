import { realpath, stat } from 'node:fs/promises'
import { apkAbis } from '../binary/apk'
import type { Command, CommandRunner } from '../command/run-command'
import {
  ADB_MISSING,
  ANDROID_ABIS,
  adbAbiListCommand,
  listAndroidDevices,
  primaryAbi,
  resolveAdb,
} from '../devices/android'
import { runTool, type Device } from '../devices/device'
import {
  FINGERPRINT_PLATFORMS,
  projectFingerprint,
  resolveFingerprintModule,
  type FingerprintPlatform,
} from '../fingerprint/fingerprint'
import { unpackIosBuild } from '../install/unpack'
import { storeLocalBuild } from '../local/store-local'
import { scanStore } from '../store/builds'
import { resolveHome, type HomeOptions } from '../store/home'
import { readAppConfig, type AppConfigValues } from './app-config'
import {
  keyMatches,
  missingAbis,
  runVariant,
  type LocalStoredBuild,
  type RunOptions,
} from './key'

export type CalculateFingerprintHashProps = {
  projectRoot: string
  platform: string
  runOptions: RunOptions
}

export type ResolveBuildCacheProps = CalculateFingerprintHashProps & {
  fingerprintHash: string
}

export type UploadBuildCacheProps = ResolveBuildCacheProps & {
  /** The APK, or the `.app` folder of an iOS simulator build. */
  buildPath: string
}

/** The plugin object that Expo CLI calls. */
export type CacheProvider = {
  calculateFingerprintHash: (
    props: CalculateFingerprintHashProps,
  ) => Promise<string | null>
  resolveBuildCache: (props: ResolveBuildCacheProps) => Promise<string | null>
  uploadBuildCache: (props: UploadBuildCacheProps) => Promise<string | null>
}

export type CacheProviderDeps = HomeOptions & {
  run: CommandRunner
  now: () => Date
  /** `process.arch`. A debug simulator build holds only this architecture. */
  arch: string
  /** A line for the terminal of Expo CLI. */
  log: (text: string) => void
  warn: (text: string) => void
  readAppConfig?: (
    projectRoot: string,
    platform: FingerprintPlatform,
  ) => AppConfigValues
}

type Targets =
  | { kind: 'known'; devices: { device: Device; abi: string }[] }
  | { kind: 'unknown'; reason: string }

export function gitHeadCommand(): Command {
  return ['git', 'rev-parse', 'HEAD']
}

/**
 * Makes the plugin. A miss is always safe, because Expo CLI then builds the
 * app. A wrong hit installs a build that does not fit. So each function
 * gives `null` when a part of the key is not known, and gives a warning in
 * place of an error.
 */
export function createCacheProvider(deps: CacheProviderDeps): CacheProvider {
  // Expo CLI asks for the hash before the build and again before the upload.
  // The build started from the files of the first call, so the second call
  // uses the same hash, and the run calculates it only one time.
  const hashes = new Map<string, Promise<string>>()

  function fingerprint(
    projectRoot: string,
    platform: FingerprintPlatform,
  ): Promise<string> {
    const key = `${projectRoot}\0${platform}`
    let hash = hashes.get(key)
    if (hash === undefined) {
      hash = Promise.resolve().then(() =>
        projectFingerprint(
          projectRoot,
          platform,
          resolveFingerprintModule(projectRoot),
        ),
      )
      hashes.set(key, hash)
      hash.catch(() => hashes.delete(key))
    }
    return hash
  }

  async function androidTargets(device: unknown): Promise<Targets> {
    const adb = resolveAdb(deps)
    const ready = (await listAndroidDevices(deps.run, adb, deps.cwd)).filter(
      (candidate) => candidate.ready,
    )
    let targets = ready
    // Expo CLI gives no device to the plugin. With --device <name>, the run
    // uses that device. Otherwise the build must fit each ready device.
    if (typeof device === 'string' && device !== '') {
      targets = ready.filter(
        (candidate) =>
          candidate.id === device ||
          candidate.name === device ||
          candidate.name.replace(/ /g, '_') === device,
      )
      if (targets.length === 0) {
        return {
          kind: 'unknown',
          reason: `No ready Android device has the name or the serial "${device}".`,
        }
      }
    }
    if (targets.length === 0) {
      return { kind: 'unknown', reason: 'No Android device is ready.' }
    }
    const devices: { device: Device; abi: string }[] = []
    for (const target of targets) {
      const result = await runTool(
        deps.run,
        adbAbiListCommand(adb, target.id),
        deps.cwd,
        ADB_MISSING,
      )
      const abi = result.code === 0 ? primaryAbi(result.stdout) : undefined
      if (abi === undefined) {
        return {
          kind: 'unknown',
          reason: `DevHub cannot read the ABI of ${target.name} (${target.id}).`,
        }
      }
      devices.push({ device: target, abi })
    }
    return { kind: 'known', devices }
  }

  async function resolveAndroid(
    builds: LocalStoredBuild[],
    runOptions: RunOptions,
  ): Promise<string | null> {
    const targets = await androidTargets(runOptions.device)
    if (targets.kind === 'unknown') {
      deps.log(`${targets.reason} Expo CLI builds the app.`)
      return null
    }
    const allArch = runOptions.allArch === true
    const abis = allArch
      ? [...ANDROID_ABIS]
      : targets.devices.map((target) => target.abi)
    const fit = builds.find((build) => missingAbis(build, abis).length === 0)
    if (fit === undefined) {
      const [newest] = builds
      const missing = newest === undefined ? abis : missingAbis(newest, abis)
      const names = allArch
        ? missing
        : targets.devices
            .filter((target) => missing.includes(target.abi))
            .map((target) => `${target.device.name} (${target.abi})`)
      deps.log(
        `The stored build ${short(newest?.id)} has the same fingerprint, but no native code for ${names.join(', ')}. Expo CLI builds the app.`,
      )
      return null
    }
    deps.log(
      `Expo CLI installs the stored build ${short(fit.id)}, and does not build the app.`,
    )
    return fit.path
  }

  async function resolveIos(
    builds: LocalStoredBuild[],
    home: string,
  ): Promise<string | null> {
    const fit = builds.find(
      (build) => build.record.local.hostArch === deps.arch,
    )
    if (fit === undefined) {
      const [newest] = builds
      deps.log(
        `The stored build ${short(newest?.id)} has the same fingerprint, but a Mac with the architecture ${newest?.record.local.hostArch ?? 'unknown'} made it. Expo CLI builds the app.`,
      )
      return null
    }
    const app = await unpackIosBuild(fit, { run: deps.run, cwd: home, home })
    deps.log(
      `Expo CLI installs the stored build ${short(fit.id)}, and does not build the app.`,
    )
    return app
  }

  /**
   * A stored build that serves each device that the new build serves. It
   * occurs when a run did not use a stored build because one ready device
   * did not fit, and Expo CLI built for a device that the old build fits.
   */
  async function findDuplicate(
    home: string,
    platform: FingerprintPlatform,
    fingerprintHash: string,
    variant: string,
    buildPath: string,
  ): Promise<LocalStoredBuild | undefined> {
    const builds = await existing(
      keyMatches(
        (await scanStore(home)).builds,
        platform,
        fingerprintHash,
        variant,
      ),
    )
    if (platform === 'ios') {
      return builds.find((build) => build.record.local.hostArch === deps.arch)
    }
    const abis = await apkAbis(buildPath)
    return builds.find(
      (build) => abis.length > 0 && missingAbis(build, abis).length === 0,
    )
  }

  return {
    async calculateFingerprintHash({ projectRoot, platform }) {
      if (!isPlatform(platform)) {
        return null
      }
      try {
        return await fingerprint(projectRoot, platform)
      } catch (error) {
        deps.warn(
          `DevHub cannot calculate the fingerprint. ${message(error)} Expo CLI does not use the DevHub store in this run.`,
        )
        return null
      }
    },

    async resolveBuildCache({
      platform,
      fingerprintHash,
      runOptions,
    }): Promise<string | null> {
      if (!isPlatform(platform)) {
        return null
      }
      try {
        const variant = runVariant(platform, runOptions)
        if (variant.kind === 'unknown') {
          deps.log(`${variant.reason} Expo CLI builds the app.`)
          return null
        }
        const home = resolveHome(deps)
        const builds = await existing(
          keyMatches(
            (await scanStore(home)).builds,
            platform,
            fingerprintHash,
            variant.variant,
          ),
        )
        if (builds.length === 0) {
          deps.log(
            `No stored build has the ${platform} fingerprint ${fingerprintHash.slice(0, 8)} and the variant ${variant.variant}. Expo CLI builds the app, and DevHub stores the build.`,
          )
          return null
        }
        return platform === 'android'
          ? await resolveAndroid(builds, runOptions)
          : await resolveIos(builds, home)
      } catch (error) {
        deps.warn(
          `DevHub cannot look for a stored build. ${message(error)} Expo CLI builds the app.`,
        )
        return null
      }
    },

    async uploadBuildCache({
      projectRoot,
      platform,
      fingerprintHash,
      buildPath,
      runOptions,
    }): Promise<string | null> {
      if (!isPlatform(platform)) {
        return null
      }
      try {
        const variant = runVariant(platform, runOptions)
        if (variant.kind === 'unknown') {
          deps.log(`DevHub does not store this build. ${variant.reason}`)
          return null
        }
        const home = resolveHome(deps)
        const duplicate = await findDuplicate(
          home,
          platform,
          fingerprintHash,
          variant.variant,
          buildPath,
        )
        if (duplicate !== undefined) {
          deps.log(
            `The DevHub store has this build already (${short(duplicate.id)}). DevHub does not store it again.`,
          )
          return duplicate.path
        }
        const project = await realpath(projectRoot)
        const config = (deps.readAppConfig ?? readAppConfig)(project, platform)
        const gitCommitHash = await gitCommit(deps.run, project)
        const stored = await storeLocalBuild(
          {
            path: buildPath,
            local: {
              platform: platform === 'android' ? 'ANDROID' : 'IOS',
              fingerprintHash,
              variant: variant.variant,
              project,
              ...config,
              ...(gitCommitHash === undefined ? {} : { gitCommitHash }),
            },
          },
          { home, run: deps.run, now: deps.now, arch: deps.arch },
        )
        deps.log(`Stored the build ${short(stored.id)} in the DevHub store.`)
        return stored.path
      } catch (error) {
        deps.warn(`DevHub cannot store the build. ${message(error)}`)
        return null
      }
    },
  }
}

function isPlatform(platform: string): platform is FingerprintPlatform {
  return (FINGERPRINT_PLATFORMS as readonly string[]).includes(platform)
}

async function existing(
  builds: LocalStoredBuild[],
): Promise<LocalStoredBuild[]> {
  const found: LocalStoredBuild[] = []
  for (const build of builds) {
    try {
      await stat(build.path)
      found.push(build)
    } catch {
      // The record names a file that is gone. Another build can serve.
    }
  }
  return found
}

async function gitCommit(
  run: CommandRunner,
  cwd: string,
): Promise<string | undefined> {
  try {
    const result = await run(gitHeadCommand(), { cwd })
    const hash = result.stdout.trim()
    return result.code === 0 && /^[0-9a-f]{40}$/.test(hash) ? hash : undefined
  } catch {
    return undefined
  }
}

function short(id: string | undefined): string {
  return id?.slice(0, 8) ?? '-'
}

function message(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return /[.!?]$/.test(text) ? text : `${text}.`
}
