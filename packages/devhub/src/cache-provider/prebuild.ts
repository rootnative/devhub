import { stat } from 'node:fs/promises'
import path from 'node:path'
import type { FingerprintPlatform } from '../fingerprint/fingerprint'

/**
 * A file that prebuild writes on each run, also with no change, and that no
 * build changes. `project.pbxproj` and `Info.plist` do not work for iOS:
 * CocoaPods changes the first, and the path of the second has the app name.
 */
const PREBUILD_FILES: Record<FingerprintPlatform, string> = {
  android: path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml'),
  ios: path.join('ios', 'Podfile'),
}

/** The names that `@expo/config` reads the app config from. */
const APP_CONFIG_FILES = [
  'app.json',
  'app.config.json',
  ...['.ts', '.mts', '.cts', '.mjs', '.cjs', '.js'].map(
    (extension) => `app.config${extension}`,
  ),
]

/**
 * The name of an app config file that changed after the last prebuild of
 * the platform, or undefined. Expo CLI runs prebuild only when the native
 * folder is missing, so after such a change it builds the old native code.
 * Gives undefined when the folder or its prebuild file is missing.
 */
export async function configNewerThanPrebuild(
  projectRoot: string,
  platform: FingerprintPlatform,
): Promise<string | undefined> {
  const prebuilt = await modified(
    path.join(projectRoot, PREBUILD_FILES[platform]),
  )
  if (prebuilt === undefined) {
    return undefined
  }
  for (const name of APP_CONFIG_FILES) {
    const changed = await modified(path.join(projectRoot, name))
    if (changed !== undefined && changed > prebuilt) {
      return name
    }
  }
  return undefined
}

async function modified(file: string): Promise<number | undefined> {
  try {
    return (await stat(file)).mtimeMs
  } catch {
    return undefined
  }
}
