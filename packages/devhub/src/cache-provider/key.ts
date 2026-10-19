import type { FingerprintPlatform } from '../fingerprint/fingerprint'
import {
  isLocalRecord,
  type LocalBuildRecord,
  type StoredBuild,
} from '../store/builds'

/**
 * The options of `npx expo run:*`, as Expo CLI gives them to the plugin.
 * DevHub reads `variant` (Android), `configuration` and `scheme` (iOS), and
 * `device`.
 */
export type RunOptions = Record<string, unknown>

export type RunVariant =
  { kind: 'known'; variant: string } | { kind: 'unknown'; reason: string }

export type LocalStoredBuild = StoredBuild & { record: LocalBuildRecord }

/** The Android variant or the iOS configuration, with the defaults of Expo CLI. */
export function runVariant(
  platform: FingerprintPlatform,
  runOptions: RunOptions,
): RunVariant {
  if (platform === 'android') {
    const { variant } = runOptions
    return {
      kind: 'known',
      variant:
        typeof variant === 'string' && variant !== '' ? variant : 'debug',
    }
  }
  const { scheme, configuration } = runOptions
  if (scheme !== undefined && scheme !== false) {
    return {
      kind: 'unknown',
      reason:
        'The run gives --scheme, and a stored build does not record its scheme.',
    }
  }
  return {
    kind: 'known',
    variant:
      typeof configuration === 'string' && configuration !== ''
        ? configuration
        : 'Debug',
  }
}

/**
 * The local builds with the same platform, fingerprint, and variant, newest
 * first. An EAS build is never in the result.
 */
export function keyMatches(
  builds: readonly StoredBuild[],
  platform: FingerprintPlatform,
  fingerprintHash: string,
  variant: string,
): LocalStoredBuild[] {
  return builds
    .filter(
      (build): build is LocalStoredBuild =>
        isLocalRecord(build.record) &&
        build.record.local.platform === platform.toUpperCase() &&
        build.record.local.fingerprintHash === fingerprintHash &&
        build.record.local.variant === variant,
    )
    .sort((a, b) => b.record.storedAt.localeCompare(a.record.storedAt))
}

/**
 * The ABIs of the APK that a target device needs and the APK does not hold.
 * An APK with no native code runs on each device. An APK whose ABIs are not
 * known fits no device.
 */
export function missingAbis(
  build: LocalStoredBuild,
  targetAbis: readonly string[],
): string[] {
  const { abis } = build.record.local
  if (abis === undefined) {
    return [...targetAbis]
  }
  if (abis.length === 0) {
    return []
  }
  return targetAbis.filter((abi) => !abis.includes(abi))
}
