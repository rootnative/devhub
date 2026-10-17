import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { artifactFileName, downloadFile } from '../sync/download'
import { easBuild, useTempDir } from './helpers'

const CONTENT = Buffer.alloc(200_000, 7)

let server: Server | undefined

afterEach(async () => {
  await new Promise((resolve) => server?.close(resolve) ?? resolve(undefined))
  server = undefined
})

/** A local server, so the test needs no network. */
async function serve(
  handler: Parameters<typeof createServer>[1],
): Promise<string> {
  server = createServer(handler)
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return `http://127.0.0.1:${port}`
}

describe('downloadFile', () => {
  const tempDir = useTempDir()

  it('writes the file and returns its size and SHA-256', async () => {
    const base = await serve((request, response) => {
      if (request.url === '/redirect') {
        response.writeHead(302, { location: '/app.apk' })
        response.end()
        return
      }
      response.writeHead(200, { 'content-length': CONTENT.length })
      response.end(CONTENT)
    })
    const dir = await tempDir()
    const target = path.join(dir, 'app.apk')

    const result = await downloadFile(`${base}/redirect`, target)

    expect(result).toEqual({
      size: CONTENT.length,
      sha256: createHash('sha256').update(CONTENT).digest('hex'),
    })
    expect(await readFile(target)).toEqual(CONTENT)
    expect(await readdir(dir)).toEqual(['app.apk'])
  })

  it('leaves no file after an HTTP error', async () => {
    const base = await serve((_request, response) => {
      response.writeHead(403)
      response.end('Forbidden')
    })
    const dir = await tempDir()

    await expect(
      downloadFile(`${base}/app.apk`, path.join(dir, 'app.apk')),
    ).rejects.toThrow('HTTP 403')
    expect(await readdir(dir)).toEqual([])
  })

  it('leaves no file when the connection closes early', async () => {
    const base = await serve((_request, response) => {
      response.writeHead(200, { 'content-length': CONTENT.length })
      response.write(CONTENT.subarray(0, 1000))
      setTimeout(() => response.destroy(), 20)
    })
    const dir = await tempDir()

    await expect(
      downloadFile(`${base}/app.apk`, path.join(dir, 'app.apk')),
    ).rejects.toThrow()
    expect(await readdir(dir)).toEqual([])
  })
})

describe('artifactFileName', () => {
  it('uses the last part of the URL path', () => {
    expect(
      artifactFileName(
        easBuild(),
        'https://expo.dev/artifacts/eas/fC9n3eUe5XhKgqN4n8a6k1.apk?x=1',
      ),
    ).toBe('fC9n3eUe5XhKgqN4n8a6k1.apk')
    expect(
      artifactFileName(easBuild(), 'https://expo.dev/a/b/my%20app.tar.gz'),
    ).toBe('my_app.tar.gz')
  })

  it.each([
    [{ platform: 'ANDROID' }, '.apk'],
    [{ platform: 'IOS', isForIosSimulator: true }, '.tar.gz'],
    [{ platform: 'IOS', isForIosSimulator: false }, '.ipa'],
  ])(
    'uses the build ID and the extension of the platform for %j',
    (overrides, extension) => {
      const build = easBuild(overrides)
      expect(artifactFileName(build, 'https://expo.dev/artifacts/eas/')).toBe(
        `${build.id}${extension}`,
      )
      expect(artifactFileName(build, 'not a url')).toBe(
        `${build.id}${extension}`,
      )
    },
  )

  it('never names the file build.json or a hidden file', () => {
    const build = easBuild()
    expect(artifactFileName(build, 'https://x.dev/build.json')).toBe(
      `${build.id}.apk`,
    )
    expect(artifactFileName(build, 'https://x.dev/.profile')).toBe(
      `${build.id}.apk`,
    )
  })
})
