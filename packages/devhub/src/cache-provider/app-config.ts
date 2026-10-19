import { createRequire } from 'node:module'
import path from 'node:path'
import type { FingerprintPlatform } from '../fingerprint/fingerprint'
import { isRecord } from '../store/files'

/** The values of the app config that a local build record keeps. */
export type AppConfigValues = {
  slug?: string
  appIdentifier?: string
  appVersion?: string
  sdkVersion?: string
}

type GetConfig = (
  projectRoot: string,
  options: { skipSDKVersionRequirement: boolean },
) => unknown

/**
 * Reads the app config with the `expo/config` of the project, the same as
 * Expo CLI. Returns no values when it cannot read the config, because the
 * values only help a person to find the build.
 */
export function readAppConfig(
  projectRoot: string,
  platform: FingerprintPlatform,
): AppConfigValues {
  let exp: unknown
  try {
    const projectRequire = createRequire(path.join(projectRoot, 'package.json'))
    const config: unknown = projectRequire('expo/config')
    if (!isRecord(config) || typeof config.getConfig !== 'function') {
      return {}
    }
    const result = (config.getConfig as GetConfig)(projectRoot, {
      skipSDKVersionRequirement: true,
    })
    exp = isRecord(result) ? result.exp : undefined
  } catch {
    return {}
  }
  if (!isRecord(exp)) {
    return {}
  }
  const native = exp[platform]
  const appIdentifier = isRecord(native)
    ? native[platform === 'android' ? 'package' : 'bundleIdentifier']
    : undefined
  const values: AppConfigValues = {
    slug: text(exp.slug),
    appIdentifier: text(appIdentifier),
    appVersion: text(exp.version),
    sdkVersion: text(exp.sdkVersion),
  }
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined),
  )
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}
