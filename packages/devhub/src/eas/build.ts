import { isRecord } from '../store/files'

export type EasPlatform = 'ANDROID' | 'IOS'

export const EAS_PLATFORMS: readonly EasPlatform[] = ['ANDROID', 'IOS']

/**
 * One build as `eas build:list --json` prints it. eas-cli drops each field
 * with a `null` value, so an absent field means "no value". DevHub stores
 * the record without changes, so the type keeps the fields it does not know.
 */
export type EasBuild = {
  id: string
  platform: string
  buildProfile?: string
  distribution?: string
  isForIosSimulator?: boolean
  appIdentifier?: string
  appVersion?: string
  appBuildVersion?: string
  sdkVersion?: string
  runtime?: { version?: string }
  fingerprint?: { hash?: string }
  gitCommitHash?: string
  gitCommitMessage?: string
  app?: { id?: string; slug?: string; name?: string }
  createdAt?: string
  completedAt?: string
  expirationDate?: string
  artifacts?: { applicationArchiveUrl?: string; buildUrl?: string }
  [field: string]: unknown
}

const STRING_FIELDS = [
  'buildProfile',
  'distribution',
  'appIdentifier',
  'appVersion',
  'appBuildVersion',
  'sdkVersion',
  'gitCommitHash',
  'gitCommitMessage',
  'createdAt',
  'completedAt',
  'expirationDate',
] as const

const NESTED_STRING_FIELDS = {
  runtime: ['version'],
  fingerprint: ['hash'],
  app: ['id', 'slug', 'name'],
  artifacts: ['applicationArchiveUrl', 'buildUrl'],
} as const

export function isEasBuild(value: unknown): value is EasBuild {
  if (!isRecord(value)) {
    return false
  }
  if (typeof value.id !== 'string' || typeof value.platform !== 'string') {
    return false
  }
  if (!isOptional(value.isForIosSimulator, 'boolean')) {
    return false
  }
  if (!STRING_FIELDS.every((field) => isOptional(value[field], 'string'))) {
    return false
  }
  return Object.entries(NESTED_STRING_FIELDS).every(([key, fields]) => {
    const nested = value[key]
    if (nested === undefined) {
      return true
    }
    return (
      isRecord(nested) &&
      fields.every((field) => isOptional(nested[field], 'string'))
    )
  })
}

function isOptional(value: unknown, type: 'string' | 'boolean'): boolean {
  return value === undefined || typeof value === type
}

/** The file to download: the application archive, or the build URL. */
export function artifactUrl(build: EasBuild): string | undefined {
  return (
    build.artifacts?.applicationArchiveUrl ||
    build.artifacts?.buildUrl ||
    undefined
  )
}

export function isExpired(build: EasBuild, now: Date): boolean {
  if (build.expirationDate === undefined) {
    return false
  }
  const expiry = Date.parse(build.expirationDate)
  return !Number.isNaN(expiry) && expiry <= now.getTime()
}
