import { mkdir, realpath, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  FingerprintError,
  projectFingerprint,
  resolveFingerprintModule,
} from '../fingerprint/fingerprint'
import { findProjectRoot } from '../fingerprint/project'
import { matchBuilds, type MatchDeps } from '../flow/match'
import {
  easBuild,
  fingerprintCalls,
  useTempDir,
  writeFingerprintProject,
  writeStoredBuild,
} from './helpers'

const ID_A = 'aaaa1111-0000-4000-8000-000000000001'
const ID_B = 'aaaa2222-0000-4000-8000-000000000002'
const ID_C = 'cccc3333-0000-4000-8000-000000000003'
const ANDROID_HASH = '1111111111111111111111111111111111111111'
const IOS_HASH = '2222222222222222222222222222222222222222'

describe('findProjectRoot', () => {
  const tempDir = useTempDir()

  it('finds the nearest folder with a package.json', async () => {
    const dir = await tempDir()
    await mkdir(path.join(dir, 'app', 'src', 'screens'), { recursive: true })
    await writeFile(path.join(dir, 'package.json'), '{}')
    await writeFile(path.join(dir, 'app', 'package.json'), '{}')

    expect(await findProjectRoot(path.join(dir, 'app', 'src', 'screens'))).toBe(
      await realpath(path.join(dir, 'app')),
    )
  })

  it('returns undefined when no folder has a package.json', async () => {
    const dir = await tempDir()
    await mkdir(path.join(dir, 'src'), { recursive: true })

    // The temporary folder is under os.tmpdir(), which has no package.json.
    expect(await findProjectRoot(path.join(dir, 'src'))).toBeUndefined()
  })
})

describe('resolveFingerprintModule', () => {
  const tempDir = useTempDir()

  it('resolves expo/fingerprint from the project folder', async () => {
    const project = await writeFingerprintProject(await tempDir(), {
      version: '0.20.13',
    })

    const module = resolveFingerprintModule(project)

    expect(module.path).toBe(
      path.join(project, 'node_modules', 'expo', 'fingerprint.js'),
    )
    expect(module.version).toBe('0.20.13')
    expect(typeof module.createFingerprintAsync).toBe('function')
  })

  it('resolves @expo/fingerprint when expo has no subpath', async () => {
    const project = await writeFingerprintProject(await tempDir(), {
      layout: 'direct',
      version: '0.11.2',
    })

    const module = resolveFingerprintModule(project)

    expect(module.path).toBe(
      path.join(
        project,
        'node_modules',
        '@expo',
        'fingerprint',
        'build',
        'index.js',
      ),
    )
    expect(module.version).toBe('0.11.2')
  })

  it('stops with the fix when the project has no module', async () => {
    const project = await tempDir()
    await writeFile(path.join(project, 'package.json'), '{}')

    expect(() => resolveFingerprintModule(project)).toThrow(
      new FingerprintError(
        `DevHub cannot find expo/fingerprint in ${project}. Expo SDK 52 and later ship it. Install the dependencies of the project, or update Expo to SDK 52 or later, and then run the command again.`,
      ),
    )
  })

  it('stops when the module has no createFingerprintAsync', async () => {
    const project = await tempDir()
    const expoDir = path.join(project, 'node_modules', 'expo')
    await mkdir(expoDir, { recursive: true })
    await writeFile(path.join(project, 'package.json'), '{}')
    await writeFile(path.join(expoDir, 'package.json'), '{"name":"expo"}')
    await writeFile(path.join(expoDir, 'fingerprint.js'), 'exports.other = 1\n')

    expect(() => resolveFingerprintModule(project)).toThrow(
      'does not export createFingerprintAsync',
    )
  })
})

describe('projectFingerprint', () => {
  const tempDir = useTempDir()

  it('calls the module with the options of eas-cli', async () => {
    const project = await writeFingerprintProject(await tempDir(), {
      hashes: { android: ANDROID_HASH, ios: IOS_HASH },
    })
    const module = resolveFingerprintModule(project)

    expect(await projectFingerprint(project, 'android', module)).toBe(
      ANDROID_HASH,
    )
    expect(await projectFingerprint(project, 'ios', module)).toBe(IOS_HASH)
    expect(await fingerprintCalls(project)).toEqual([
      {
        projectRoot: project,
        options: { platforms: ['android'], silent: true },
      },
      { projectRoot: project, options: { platforms: ['ios'], silent: true } },
    ])
  })

  it('reports a failure of the module', async () => {
    const project = await writeFingerprintProject(await tempDir(), {
      failure: 'ENOENT: no such file or directory',
    })

    await expect(
      projectFingerprint(project, 'ios', resolveFingerprintModule(project)),
    ).rejects.toThrow(
      new FingerprintError(
        `@expo/fingerprint failed for ios in ${project}: ENOENT: no such file or directory`,
      ),
    )
  })

  it('reports a result with no hash', async () => {
    const project = await writeFingerprintProject(await tempDir(), {
      hashes: { ios: IOS_HASH },
    })

    await expect(
      projectFingerprint(project, 'android', resolveFingerprintModule(project)),
    ).rejects.toThrow('@expo/fingerprint gave no hash for android')
  })
})

describe('matchBuilds', () => {
  const tempDir = useTempDir()

  function deps(home: string, cwd: string) {
    const progress: string[] = []
    const value: MatchDeps = {
      env: { DEVHUB_HOME: home },
      platform: process.platform,
      homedir: os.homedir(),
      cwd,
      progress: (text) => progress.push(text),
    }
    return { deps: value, progress }
  }

  it('finds the builds with the same hash for each platform', async () => {
    const home = await tempDir()
    const project = await writeFingerprintProject(await tempDir(), {
      hashes: { android: ANDROID_HASH, ios: IOS_HASH },
    })
    await writeStoredBuild(
      home,
      easBuild({
        id: ID_A,
        fingerprint: { hash: ANDROID_HASH },
        createdAt: '2026-10-01T10:00:00.000Z',
      }),
    )
    await writeStoredBuild(
      home,
      easBuild({
        id: ID_B,
        fingerprint: { hash: ANDROID_HASH },
        createdAt: '2026-10-03T10:00:00.000Z',
      }),
    )
    await writeStoredBuild(
      home,
      easBuild({
        id: ID_C,
        platform: 'IOS',
        isForIosSimulator: true,
        fingerprint: { hash: ANDROID_HASH },
      }),
      'app.tar.gz',
    )
    const { deps: value, progress } = deps(home, path.join(project, 'src'))
    await mkdir(path.join(project, 'src'))

    const result = await matchBuilds({ platforms: ['android', 'ios'] }, value)

    expect(result).toMatchObject({
      kind: 'ok',
      value: {
        project,
        fingerprintVersion: '0.20.13',
        platforms: [
          {
            platform: 'android',
            hash: ANDROID_HASH,
            matches: [{ id: ID_B }, { id: ID_A }],
          },
          { platform: 'ios', hash: IOS_HASH, matches: [] },
        ],
      },
    })
    expect(progress).toEqual([
      `Calculating the android fingerprint of ${project}.`,
      `Calculating the ios fingerprint of ${project}.`,
    ])
  })

  it('ignores a record with no fingerprint', async () => {
    const home = await tempDir()
    const project = await writeFingerprintProject(await tempDir(), {
      hashes: { android: ANDROID_HASH },
    })
    await writeStoredBuild(home, easBuild({ id: ID_A }))

    const result = await matchBuilds(
      { platforms: ['android'] },
      deps(home, project).deps,
    )

    expect(result).toMatchObject({
      kind: 'ok',
      value: { platforms: [{ platform: 'android', matches: [] }] },
    })
  })

  it('stops with the fix when the folder is not a project', async () => {
    const home = await tempDir()
    const cwd = await tempDir()

    const result = await matchBuilds(
      { platforms: ['android'] },
      deps(home, cwd).deps,
    )

    expect(result).toEqual({
      kind: 'error',
      usage: false,
      message: `${cwd} and its parent folders have no package.json. Run devhub match in the folder of an Expo project.`,
    })
  })

  it('returns the error of the module as a failure', async () => {
    const home = await tempDir()
    const project = await writeFingerprintProject(await tempDir(), {
      failure: 'bad config',
    })

    const result = await matchBuilds(
      { platforms: ['ios'] },
      deps(home, project).deps,
    )

    expect(result).toMatchObject({
      kind: 'error',
      message: `@expo/fingerprint failed for ios in ${project}: bad config`,
    })
  })
})
