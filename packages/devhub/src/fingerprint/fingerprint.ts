import { createRequire } from 'node:module'
import path from 'node:path'
import { isRecord } from '../store/files'

export type FingerprintPlatform = 'android' | 'ios'

export const FINGERPRINT_PLATFORMS: readonly FingerprintPlatform[] = [
  'android',
  'ios',
]

export class FingerprintError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FingerprintError'
  }
}

type FingerprintOptions = {
  platforms: FingerprintPlatform[]
  silent: boolean
}

type CreateFingerprint = (
  projectRoot: string,
  options: FingerprintOptions,
) => Promise<unknown>

/** The `@expo/fingerprint` of one project. */
export type FingerprintModule = {
  /** The resolved file. */
  path: string
  /** The version of `@expo/fingerprint`, when its package.json resolves. */
  version: string | undefined
  createFingerprintAsync: CreateFingerprint
}

/**
 * eas-cli resolves `expo/fingerprint`, which the `expo` package exports since
 * SDK 52. `@expo/fingerprint` is for a project that installed the package
 * itself.
 */
const MODULE_NAMES = ['expo/fingerprint', '@expo/fingerprint'] as const

/**
 * Loads the `@expo/fingerprint` of the project, from the project folder. A
 * bundled copy can calculate a different hash, and then the user gets the
 * wrong build or no match.
 */
export function resolveFingerprintModule(
  projectDir: string,
): FingerprintModule {
  const projectRequire = createRequire(path.join(projectDir, 'package.json'))
  let file: string | undefined
  for (const name of MODULE_NAMES) {
    try {
      file = projectRequire.resolve(name)
      break
    } catch {
      // Not this name. Try the next one.
    }
  }
  if (file === undefined) {
    throw new FingerprintError(
      `DevHub cannot find expo/fingerprint in ${projectDir}. Expo SDK 52 and later ship it. Install the dependencies of the project, or update Expo to SDK 52 or later, and then run the command again.`,
    )
  }
  const loaded: unknown = projectRequire(file)
  if (
    !isRecord(loaded) ||
    typeof loaded.createFingerprintAsync !== 'function'
  ) {
    throw new FingerprintError(
      `${file} does not export createFingerprintAsync. Update Expo, and then run the command again.`,
    )
  }
  return {
    path: file,
    version: fingerprintVersion(file),
    createFingerprintAsync: loaded.createFingerprintAsync as CreateFingerprint,
  }
}

/**
 * Calculates the hash of the project for one platform. eas-cli 25.2.0 passes
 * these options when it records the hash of a build. A different option
 * gives a different hash, and then no build matches.
 */
export async function projectFingerprint(
  projectDir: string,
  platform: FingerprintPlatform,
  module: FingerprintModule,
): Promise<string> {
  let result: unknown
  try {
    result = await module.createFingerprintAsync(projectDir, {
      platforms: [platform],
      silent: true,
    })
  } catch (error) {
    throw new FingerprintError(
      `@expo/fingerprint failed for ${platform} in ${projectDir}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  if (
    !isRecord(result) ||
    typeof result.hash !== 'string' ||
    result.hash === ''
  ) {
    throw new FingerprintError(
      `@expo/fingerprint gave no hash for ${platform} in ${projectDir}. Update Expo, and then run the command again.`,
    )
  }
  // A fingerprint with no sources is the hash of nothing. Each project that
  // gets it has the same hash, so it would match the builds of another app.
  if (Array.isArray(result.sources) && result.sources.length === 0) {
    throw new FingerprintError(
      `@expo/fingerprint found no native inputs for ${platform} in ${projectDir}. Install the dependencies of the project, and then run the command again.`,
    )
  }
  return result.hash
}

function fingerprintVersion(file: string): string | undefined {
  try {
    const pkg: unknown = createRequire(file)('@expo/fingerprint/package.json')
    return isRecord(pkg) && typeof pkg.version === 'string'
      ? pkg.version
      : undefined
  } catch {
    return undefined
  }
}
