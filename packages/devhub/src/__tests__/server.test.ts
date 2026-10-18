import { mkdir, writeFile } from 'node:fs/promises'
import { request as httpRequest, type IncomingHttpHeaders } from 'node:http'
import { createServer, type AddressInfo } from 'node:net'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CliContext } from '../cli/context'
import { EXIT_CODE, run } from '../cli/run'
import type { Command } from '../command/run-command'
import type { CommandStarter } from '../command/start-command'
import { openUrlCommand } from '../server/browser'
import { pageFile } from '../server/files'
import { acquireSyncLock, StoreLockedError } from '../store/lock'
import {
  capture,
  easBuild,
  fakeDeviceTools,
  fakeDownload,
  fakeEas,
  testContext,
  useTempDir,
  writeProject,
  writeStoredBuild,
} from './helpers'

const ID_A = 'aaaa1111-0000-4000-8000-000000000001'
const ID_B = 'bbbb2222-0000-4000-8000-000000000002'
const ADB_OUTPUT = [
  'List of devices attached',
  'emulator-5554  device product:sdk_gphone64_x86_64 model:sdk_gphone64_x86_64',
  'R58M12ABCDE    unauthorized usb:1-1 transport_id:2',
  '',
].join('\n')

type Reply = { status: number; headers: IncomingHttpHeaders; text: string }

type RequestOptions = {
  method?: string
  path?: string
  headers?: Record<string, string>
  body?: string
}

/** A request with node:http, which sends each header as given. */
function send(port: number, options: RequestOptions = {}): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        host: '127.0.0.1',
        port,
        method: options.method ?? 'GET',
        path: options.path ?? '/',
        headers: options.headers,
        agent: false,
      },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => chunks.push(chunk))
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            text: Buffer.concat(chunks).toString('utf8'),
          }),
        )
      },
    )
    request.on('error', reject)
    request.end(options.body)
  })
}

type RunningUi = {
  url: string
  port: number
  token: string
  out: string[]
  err: string[]
  started: Command[]
  stop: () => Promise<number>
  auth: () => Record<string, string>
  post: () => Record<string, string>
}

const running: RunningUi[] = []

afterEach(async () => {
  await Promise.all(running.splice(0).map((ui) => ui.stop()))
})

/**
 * Runs `devhub ui` until the test stops it. The browser starter is always a
 * fake, so a test never opens a real browser.
 */
async function startUi(
  context: Partial<CliContext> & { home: string },
  options: { argv?: string[]; start?: CommandStarter } = {},
): Promise<RunningUi> {
  const { io, out, err } = capture()
  const started: Command[] = []
  let stopUi = () => {}
  const stopped = new Promise<void>((resolve) => {
    stopUi = resolve
  })
  let listening = () => {}
  // The command prints this line after its warnings, and opens the browser
  // in the same tick.
  const ready = new Promise<void>((resolve) => {
    listening = resolve
  })
  const exit = run(['ui', ...(options.argv ?? ['--no-open', '--json'])], {
    ...testContext({ ...context, io }),
    io: {
      out: io.out,
      err: (text) => {
        io.err(text)
        if (text === 'Press Ctrl+C to stop the server.') {
          listening()
        }
      },
    },
    start: async (command, commandOptions) => {
      started.push(command)
      return options.start ? options.start(command, commandOptions) : 0
    },
    waitForStop: () => stopped,
  })
  await Promise.race([
    ready,
    exit.then((code) => {
      throw new Error(`devhub ui exited with ${code}: ${err.join('\n')}`)
    }),
  ])
  const line = out.join('\n')
  const json = line.startsWith('{')
  const url = json
    ? (JSON.parse(line) as { url: string }).url
    : line.replace('RootNative DevHub runs at ', '')
  const port = Number(new URL(url).port)
  const token = new URL(url).hash.replace('#token=', '')
  let exitCode: Promise<number> | undefined
  const ui: RunningUi = {
    url,
    port,
    token,
    out,
    err,
    started,
    stop: () => {
      exitCode ??= (stopUi(), exit)
      return exitCode
    },
    auth: () => ({ authorization: `Bearer ${token}` }),
    post: () => ({
      authorization: `Bearer ${token}`,
      origin: `http://127.0.0.1:${port}`,
      'content-type': 'application/json',
    }),
  }
  running.push(ui)
  return ui
}

function json(reply: Reply): unknown {
  return JSON.parse(reply.text)
}

/** Runs one CLI command, and returns its stdout as JSON and its stderr. */
async function cliJson(
  argv: string[],
  context: Partial<CliContext> & { home: string },
) {
  const { io, out, err } = capture()
  const code = await run(argv, testContext({ ...context, io }))
  return {
    code,
    json: out.length > 0 ? JSON.parse(out.join('\n')) : undefined,
    err,
  }
}

describe('devhub ui', () => {
  const tempDir = useTempDir()

  it('prints the URL with a new token, and stops on Ctrl+C', async () => {
    const home = await tempDir()
    const ui = await startUi({ home, uiFiles: home }, { argv: ['--no-open'] })

    expect(ui.out).toEqual([`RootNative DevHub runs at ${ui.url}`])
    expect(ui.url).toMatch(
      /^http:\/\/127\.0\.0\.1:\d+\/#token=[A-Za-z0-9_-]{43}$/,
    )
    expect(ui.err).toContain('Press Ctrl+C to stop the server.')
    const second = await startUi({ home, uiFiles: home })
    expect(second.token).not.toBe(ui.token)

    expect(await ui.stop()).toBe(EXIT_CODE.ok)
    expect(ui.err).toContain('The server stopped.')
    await expect(send(ui.port)).rejects.toMatchObject({ code: 'ECONNREFUSED' })
  })

  it('prints the URL and the port as JSON with --json', async () => {
    const home = await tempDir()
    const ui = await startUi({ home, uiFiles: home })

    expect(JSON.parse(ui.out.join('\n'))).toEqual({
      url: ui.url,
      port: ui.port,
    })
  })

  it('opens the URL in the browser', async () => {
    const home = await tempDir()
    const ui = await startUi({ home, uiFiles: home }, { argv: [] })

    expect(ui.started).toEqual([openUrlCommand(ui.url, process.platform)])
  })

  it('only warns when the browser does not open', async () => {
    const home = await tempDir()
    const missing = Object.assign(new Error('spawn xdg-open ENOENT'), {
      code: 'ENOENT',
    })
    const ui = await startUi(
      { home, uiFiles: home },
      { argv: [], start: () => Promise.reject(missing) },
    )

    await vi.waitFor(() =>
      expect(ui.err.join('\n')).toContain(
        'Warning: DevHub cannot open the browser.',
      ),
    )
    expect(ui.err.join('\n')).toContain('Open the URL by hand.')
    expect((await send(ui.port, { headers: ui.auth() })).status).toBe(404)
  })

  it('does not open the browser with --no-open', async () => {
    const home = await tempDir()
    const ui = await startUi({ home, uiFiles: home })

    expect(ui.started).toEqual([])
  })

  it('warns when the build has no page', async () => {
    const home = await tempDir()
    const ui = await startUi({ home, uiFiles: path.join(home, 'ui') })

    expect(ui.err.join('\n')).toContain(
      'Warning: this build of DevHub has no page.',
    )
  })

  it('fails when the port is in use', async () => {
    const home = await tempDir()
    const blocker = createServer()
    await new Promise<void>((resolve) =>
      blocker.listen(0, '127.0.0.1', resolve),
    )
    const { port } = blocker.address() as AddressInfo
    const { io, out, err } = capture()

    try {
      const code = await run(
        ['ui', '--port', String(port), '--no-open'],
        testContext({ io, home, uiFiles: home }),
      )

      expect(code).toBe(EXIT_CODE.failure)
      expect(out).toEqual([])
      expect(err.join('\n')).toContain(`The port ${port} is in use.`)
    } finally {
      await new Promise((resolve) => blocker.close(resolve))
    }
  })
})

describe('devhub ui API', () => {
  const tempDir = useTempDir()

  it('GET /api/builds returns the JSON of devhub list --json', async () => {
    const home = await tempDir()
    await writeStoredBuild(home, easBuild({ id: ID_A }))
    await writeStoredBuild(home, easBuild({ id: ID_B, platform: 'IOS' }))
    const ui = await startUi({ home, uiFiles: home })

    const reply = await send(ui.port, {
      path: '/api/builds',
      headers: ui.auth(),
    })

    expect(reply.status).toBe(200)
    expect(reply.headers['content-type']).toBe(
      'application/json; charset=utf-8',
    )
    expect(json(reply)).toEqual(
      (await cliJson(['list', '--json'], { home })).json,
    )
  })

  it('GET /api/devices returns the JSON of devhub devices --json', async () => {
    const home = await tempDir()
    const tools = fakeDeviceTools({
      devices: ADB_OUTPUT,
      avdNames: { 'emulator-5554': 'Pixel_8' },
    })
    const ui = await startUi({ home, uiFiles: home, run: tools.run })

    const reply = await send(ui.port, {
      path: '/api/devices',
      headers: ui.auth(),
    })

    expect(reply.status).toBe(200)
    const cli = await cliJson(['devices', '--json'], { home, run: tools.run })
    expect(json(reply)).toEqual(cli.json)
    expect(json(reply)).toMatchObject({
      devices: [
        { id: 'emulator-5554', name: 'Pixel_8', ready: true },
        { id: 'R58M12ABCDE', ready: false },
      ],
    })
  })

  it('POST /api/install returns the JSON of devhub install --json', async () => {
    const home = await tempDir()
    await writeStoredBuild(home, easBuild({ id: ID_A }))
    const tools = fakeDeviceTools({
      devices: ADB_OUTPUT,
      avdNames: { 'emulator-5554': 'Pixel_8' },
    })
    const ui = await startUi({ home, uiFiles: home, run: tools.run })

    const reply = await send(ui.port, {
      method: 'POST',
      path: '/api/install',
      headers: ui.post(),
      body: JSON.stringify({ id: 'aaaa1111', device: 'emulator-5554' }),
    })

    expect(reply.status).toBe(200)
    const cli = await cliJson(
      ['install', 'aaaa1111', '--device', 'emulator-5554', '--json'],
      { home, run: tools.run },
    )
    expect(json(reply)).toEqual(cli.json)
    expect(ui.err).toContain(
      `Installing the build ${ID_A} on Pixel_8 (emulator-5554).`,
    )
    expect(
      tools.calls.filter((command) => command.includes('install')),
    ).toHaveLength(2)
  })

  it('POST /api/install gives 422 with the message of the CLI', async () => {
    const home = await tempDir()
    const tools = fakeDeviceTools({ devices: ADB_OUTPUT })
    const ui = await startUi({ home, uiFiles: home, run: tools.run })

    const reply = await send(ui.port, {
      method: 'POST',
      path: '/api/install',
      headers: ui.post(),
      body: JSON.stringify({ id: 'nope', device: 'emulator-5554' }),
    })

    expect(reply.status).toBe(422)
    const cli = await cliJson(
      ['install', 'nope', '--device', 'emulator-5554', '--json'],
      { home, run: tools.run },
    )
    expect(cli.code).toBe(EXIT_CODE.failure)
    expect(json(reply)).toEqual({ error: cli.err.join('\n') })
  })

  it.each([
    [{ id: ID_A }],
    [{ device: 'emulator-5554' }],
    [{ id: '', device: 'emulator-5554' }],
    [{ id: 7, device: 'emulator-5554' }],
    [[ID_A, 'emulator-5554']],
  ])('POST /api/install with %j gives 400', async (body) => {
    const home = await tempDir()
    const tools = fakeDeviceTools({ devices: ADB_OUTPUT })
    const ui = await startUi({ home, uiFiles: home, run: tools.run })

    const reply = await send(ui.port, {
      method: 'POST',
      path: '/api/install',
      headers: ui.post(),
      body: JSON.stringify(body),
    })

    expect(reply.status).toBe(400)
    expect(json(reply)).toEqual({
      error:
        'The request needs "id", the build ID, and "device", the device ID.',
    })
    expect(tools.calls).toEqual([])
  })

  async function syncSetup() {
    const root = await tempDir()
    const home = path.join(root, 'home')
    const project = await writeProject(path.join(root, 'app'), {
      build: { development: { developmentClient: true } },
    })
    await writeStoredBuild(home, easBuild({ id: ID_A }))
    await writeFile(
      path.join(home, 'projects.json'),
      JSON.stringify({ schemaVersion: 1, projects: [{ path: project }] }),
    )
    const eas = fakeEas({
      development: [
        easBuild({ id: ID_A }),
        easBuild({ id: ID_B, expirationDate: '2026-10-02T00:00:00.000Z' }),
      ],
    })
    const context = {
      home,
      cwd: root,
      uiFiles: root,
      run: eas.run,
      download: fakeDownload(),
    }
    return { home, context }
  }

  it('POST /api/sync returns the JSON of devhub sync --all --json', async () => {
    const { context } = await syncSetup()
    const ui = await startUi(context)

    const reply = await send(ui.port, {
      method: 'POST',
      path: '/api/sync',
      headers: ui.post(),
      body: '{}',
    })

    expect(reply.status).toBe(200)
    const cli = await cliJson(['sync', '--all', '--json'], context)
    expect(json(reply)).toEqual(cli.json)
    expect(json(reply)).toMatchObject({
      dryRun: false,
      projects: [
        {
          status: 'ok',
          builds: [
            { id: ID_A, status: 'stored' },
            { id: ID_B, status: 'expired' },
          ],
        },
      ],
    })
  })

  it('POST /api/sync gives 422 with the lock message while a sync runs', async () => {
    const { home, context } = await syncSetup()
    const ui = await startUi(context)
    const lock = await acquireSyncLock(home)

    try {
      const reply = await send(ui.port, {
        method: 'POST',
        path: '/api/sync',
        headers: ui.post(),
      })

      expect(reply.status).toBe(422)
      expect(json(reply)).toEqual({
        error: new StoreLockedError(process.pid).message,
      })
    } finally {
      await lock.release()
    }
  })

  it('gives 500 for an error that the code did not expect, and keeps running', async () => {
    const home = await tempDir()
    const ui = await startUi({
      home,
      uiFiles: home,
      run: () => Promise.reject(new Error('boom')),
    })

    const reply = await send(ui.port, {
      path: '/api/devices',
      headers: ui.auth(),
    })

    expect(reply.status).toBe(500)
    expect(json(reply)).toEqual({
      error: 'DevHub hit an error that it did not expect: boom',
    })
    expect(ui.err).toContain('DevHub hit an error that it did not expect: boom')
    expect(
      (await send(ui.port, { path: '/api/builds', headers: ui.auth() })).status,
    ).toBe(200)
  })

  it('gives 404 for an API that does not exist, and 405 for a wrong method', async () => {
    const home = await tempDir()
    const ui = await startUi({ home, uiFiles: home })

    const missing = await send(ui.port, {
      path: '/api/launch',
      headers: ui.auth(),
    })
    const wrong = await send(ui.port, {
      path: '/api/install',
      headers: ui.auth(),
    })

    expect(missing.status).toBe(404)
    expect(json(missing)).toEqual({ error: 'DevHub has no API /api/launch.' })
    expect(wrong.status).toBe(405)
    expect(wrong.headers.allow).toBe('POST')
    expect(json(wrong)).toEqual({ error: 'Use POST for /api/install.' })
  })

  it('gives 400 for a body that is not JSON, and 413 for a large body', async () => {
    const home = await tempDir()
    const ui = await startUi({ home, uiFiles: home })

    const broken = await send(ui.port, {
      method: 'POST',
      path: '/api/install',
      headers: ui.post(),
      body: '{ "id": ',
    })
    const large = await send(ui.port, {
      method: 'POST',
      path: '/api/install',
      headers: ui.post(),
      body: JSON.stringify({ id: 'x'.repeat(70_000), device: 'd' }),
    })

    expect(broken.status).toBe(400)
    expect(json(broken)).toEqual({
      error: 'The request body is not valid JSON.',
    })
    expect(large.status).toBe(413)
  })
})

describe('devhub ui guard', () => {
  const tempDir = useTempDir()

  async function guarded() {
    const home = await tempDir()
    const tools = fakeDeviceTools({ devices: ADB_OUTPUT })
    const ui = await startUi({ home, uiFiles: home, run: tools.run })
    return { ui, tools }
  }

  it.each([
    ['GET', '/api/builds'],
    ['GET', '/api/devices'],
    ['POST', '/api/install'],
    ['POST', '/api/sync'],
  ])('%s %s without the token gives 401', async (method, route) => {
    const { ui, tools } = await guarded()
    const { authorization: _, ...noToken } = ui.post()

    for (const headers of [
      noToken,
      { ...noToken, authorization: 'Bearer wrong' },
      { ...noToken, authorization: `Bearer ${ui.token}x` },
      { ...noToken, authorization: ui.token },
    ]) {
      const reply = await send(ui.port, {
        method,
        path: route,
        headers,
        body: '{}',
      })

      expect(reply.status).toBe(401)
      expect(json(reply)).toEqual({
        error:
          'The request has no valid token. Open the URL that devhub ui printed.',
      })
    }
    expect(tools.calls).toEqual([])
  })

  it.each([['localhost'], ['evil.example'], ['127.0.0.1']])(
    'the Host %s:<port> gives 403, also for the page',
    async (host) => {
      const { ui } = await guarded()
      const headers = { ...ui.auth(), host: `${host}:${ui.port}` }
      const wrongPort = { ...ui.auth(), host: `127.0.0.1:${ui.port + 1}` }

      const sent = host === '127.0.0.1' ? wrongPort : headers
      for (const route of ['/api/builds', '/']) {
        const reply = await send(ui.port, { path: route, headers: sent })

        expect(reply.status).toBe(403)
        expect(reply.text).toContain(
          `DevHub accepts only requests to 127.0.0.1:${ui.port}.`,
        )
      }
    },
  )

  it('a POST with no Origin, or another Origin, gives 403', async () => {
    const { ui, tools } = await guarded()
    const { origin: _, ...noOrigin } = ui.post()

    for (const headers of [
      noOrigin,
      { ...noOrigin, origin: 'http://evil.example' },
      { ...noOrigin, origin: `http://localhost:${ui.port}` },
      { ...noOrigin, origin: 'null' },
    ]) {
      const reply = await send(ui.port, {
        method: 'POST',
        path: '/api/sync',
        headers,
      })

      expect(reply.status).toBe(403)
      expect(json(reply)).toEqual({
        error: `DevHub accepts a POST request only from the page at http://127.0.0.1:${ui.port}.`,
      })
    }
    expect(tools.calls).toEqual([])
  })

  it('a POST without the type application/json gives 403', async () => {
    const { ui, tools } = await guarded()

    for (const type of [
      undefined,
      'text/plain',
      'application/x-www-form-urlencoded',
      'multipart/form-data; boundary=x',
    ]) {
      const { 'content-type': _, ...headers } = ui.post()
      const reply = await send(ui.port, {
        method: 'POST',
        path: '/api/sync',
        headers:
          type === undefined ? headers : { ...headers, 'content-type': type },
        body: '{}',
      })

      expect(reply.status).toBe(403)
      expect(json(reply)).toEqual({
        error: 'A POST request must have the type application/json.',
      })
    }
    expect(tools.calls).toEqual([])
  })

  it('accepts application/json with a charset', async () => {
    const home = await tempDir()
    await writeStoredBuild(home, easBuild({ id: ID_A }))
    const tools = fakeDeviceTools({ devices: ADB_OUTPUT })
    const ui = await startUi({ home, uiFiles: home, run: tools.run })

    const reply = await send(ui.port, {
      method: 'POST',
      path: '/api/install',
      headers: {
        ...ui.post(),
        'content-type': 'Application/JSON; charset=utf-8',
      },
      body: JSON.stringify({ id: ID_A, device: 'emulator-5554' }),
    })

    expect(reply.status).toBe(200)
  })

  it('sends the security headers and no CORS headers', async () => {
    const { ui } = await guarded()

    for (const reply of [
      await send(ui.port, { path: '/api/builds', headers: ui.auth() }),
      await send(ui.port, { path: '/api/builds' }),
      await send(ui.port, { path: '/' }),
    ]) {
      expect(reply.headers['content-security-policy']).toBe(
        "default-src 'self'; frame-ancestors 'none'",
      )
      expect(reply.headers['x-content-type-options']).toBe('nosniff')
      expect(
        Object.keys(reply.headers).filter((name) =>
          name.startsWith('access-control-'),
        ),
      ).toEqual([])
    }
  })
})

describe('devhub ui page', () => {
  const tempDir = useTempDir()

  async function withPage() {
    const root = await tempDir()
    const files = path.join(root, 'ui')
    await mkdir(path.join(files, 'assets'), { recursive: true })
    await writeFile(path.join(files, 'index.html'), '<!doctype html><p>DevHub')
    await writeFile(path.join(files, 'assets', 'app.js'), 'console.log(1)')
    await writeFile(path.join(root, 'secret.txt'), 'secret')
    const ui = await startUi({ home: path.join(root, 'home'), uiFiles: files })
    return { ui }
  }

  it('serves the page with no token', async () => {
    const { ui } = await withPage()

    const page = await send(ui.port, { path: '/' })
    const script = await send(ui.port, { path: '/assets/app.js' })
    const head = await send(ui.port, { method: 'HEAD', path: '/index.html' })

    expect(page.status).toBe(200)
    expect(page.headers['content-type']).toBe('text/html; charset=utf-8')
    expect(page.text).toBe('<!doctype html><p>DevHub')
    expect(script.status).toBe(200)
    expect(script.headers['content-type']).toBe(
      'text/javascript; charset=utf-8',
    )
    expect(head.status).toBe(200)
    expect(head.headers['content-length']).toBe('24')
    expect(head.text).toBe('')
    expect(ui.err.join('\n')).not.toContain('has no page')
  })

  it.each([
    ['/missing.js'],
    ['/assets'],
    ['/assets/'],
    ['/../secret.txt'],
    ['/%2e%2e/secret.txt'],
    ['/..%2fsecret.txt'],
    ['/..%5csecret.txt'],
    ['/assets/..%2f..%2fsecret.txt'],
    ['/%E0%A4%A'],
  ])('gives 404 for %s', async (requestPath) => {
    const { ui } = await withPage()

    const reply = await send(ui.port, { path: requestPath })

    expect(reply.status).toBe(404)
    expect(reply.text).not.toContain('secret')
  })

  it('gives 405 for a POST to a file of the page', async () => {
    const { ui } = await withPage()

    const reply = await send(ui.port, { method: 'POST', path: '/' })

    expect(reply.status).toBe(405)
    expect(reply.headers.allow).toBe('GET, HEAD')
  })
})

describe('pageFile', () => {
  const root = path.resolve('/srv/ui')

  it.each([
    ['/', path.join(root, 'index.html')],
    ['/index.html', path.join(root, 'index.html')],
    ['/assets/app.js', path.join(root, 'assets', 'app.js')],
    ['/assets/a%20b.js', path.join(root, 'assets', 'a b.js')],
    ['/assets/../index.html', path.join(root, 'index.html')],
  ])('maps %s into the page folder', (pathname, file) => {
    expect(pageFile(root, pathname)).toBe(file)
  })

  it.each([
    ['/../secret.txt', path.join(root, 'secret.txt')],
    ['/..%2f..%2fsecret.txt', path.join(root, 'secret.txt')],
    ['/assets/../../../secret.txt', path.join(root, 'secret.txt')],
  ])('keeps %s inside the page folder', (pathname, file) => {
    expect(pageFile(root, pathname)).toBe(file)
  })

  it.each([
    ['/..%5csecret.txt'],
    ['/C:/Windows/win.ini'],
    ['/index.html:stream'],
    ['/a%00b'],
    ['/%E0%A4%A'],
    ['relative'],
  ])('refuses %s', (pathname) => {
    expect(pageFile(root, pathname)).toBeUndefined()
  })
})

describe('openUrlCommand', () => {
  const url = 'http://127.0.0.1:4000/#token=abc'

  it.each([
    ['darwin', ['open', url]],
    ['linux', ['xdg-open', url]],
    ['win32', ['rundll32', 'url.dll,FileProtocolHandler', url]],
  ] as const)('on %s gives %j', (platform, command) => {
    expect(openUrlCommand(url, platform)).toEqual(command)
  })
})
