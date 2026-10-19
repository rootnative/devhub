import os from 'node:os'
import { runCommand } from '../command/run-command'
import { createCacheProvider } from './provider'

/**
 * The Expo build cache provider of DevHub. In the app config:
 *
 *   "buildCacheProvider": { "plugin": "@rootnative/devhub/cache-provider" }
 *
 * Expo CLI loads this file with `require`, so it must not import the core
 * index, and must have no top-level `await`.
 */
const provider = createCacheProvider({
  env: process.env,
  platform: process.platform,
  homedir: os.homedir(),
  cwd: process.cwd(),
  run: runCommand,
  now: () => new Date(),
  arch: process.arch,
  log: (text) => console.log(`› DevHub: ${text}`),
  warn: (text) => console.warn(`› DevHub: ${text}`),
})

export const calculateFingerprintHash = provider.calculateFingerprintHash
export const resolveBuildCache = provider.resolveBuildCache
export const uploadBuildCache = provider.uploadBuildCache

export type {
  CalculateFingerprintHashProps,
  ResolveBuildCacheProps,
  UploadBuildCacheProps,
} from './provider'
export type { RunOptions } from './key'
