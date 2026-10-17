import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { ReadableStream } from 'node:stream/web'
import type { EasBuild } from '../eas/build'
import { isSafeFileName } from '../store/builds'
import { tempPath } from '../store/files'

export type DownloadResult = { size: number; sha256: string }

/**
 * Downloads a URL to `target`. The file appears at `target` only when the
 * download is complete.
 */
export type Downloader = (
  url: string,
  target: string,
) => Promise<DownloadResult>

export const downloadFile: Downloader = async (url, target) => {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok || response.body === null) {
    throw new Error(
      `The download failed with HTTP ${response.status} ${response.statusText}.`.trim(),
    )
  }
  const hash = createHash('sha256')
  let size = 0
  const measure = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk)
      size += chunk.length
      callback(null, chunk)
    },
  })
  const temp = tempPath(target)
  try {
    await pipeline(
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>),
      measure,
      createWriteStream(temp, { flags: 'wx' }),
    )
    const expected = expectedSize(response)
    if (expected !== undefined && expected !== size) {
      throw new Error(
        `The download stopped after ${size} of ${expected} bytes.`,
      )
    }
    await rename(temp, target)
  } catch (error) {
    await rm(temp, { force: true })
    throw error
  }
  return { size, sha256: hash.digest('hex') }
}

/**
 * The name of the build file in its folder: the last part of the URL path,
 * or the build ID with the usual extension of the platform.
 */
export function artifactFileName(build: EasBuild, url: string): string {
  let name = ''
  try {
    name = decodeURIComponent(path.posix.basename(new URL(url).pathname))
  } catch {
    // A URL that cannot be read gets the default name.
  }
  name = name.replace(/[^A-Za-z0-9._-]/g, '_')
  if (isSafeFileName(name) && name.includes('.')) {
    return name
  }
  return `${build.id}${defaultExtension(build)}`
}

function defaultExtension(build: EasBuild): string {
  if (build.platform === 'ANDROID') {
    return '.apk'
  }
  if (build.platform === 'IOS') {
    return build.isForIosSimulator ? '.tar.gz' : '.ipa'
  }
  return ''
}

/** fetch decompresses an encoded body, so Content-Length then does not apply. */
function expectedSize(response: Response): number | undefined {
  if (response.headers.get('content-encoding')) {
    return undefined
  }
  const length = Number(response.headers.get('content-length') ?? Number.NaN)
  return Number.isSafeInteger(length) && length >= 0 ? length : undefined
}
