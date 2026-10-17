import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  EasJsonError,
  devClientProfiles,
  findEasProject,
  parseEasJson,
  readEasJson,
  withExtraProfiles,
} from '../eas/profiles'
import { useTempDir, writeProject } from './helpers'

describe('devClientProfiles', () => {
  it('finds each profile with "developmentClient": true', () => {
    const result = devClientProfiles({
      build: {
        development: { developmentClient: true, distribution: 'internal' },
        preview: { distribution: 'internal' },
        production: {},
      },
    })

    expect(result.profiles).toEqual([
      { name: 'development', platforms: ['ANDROID', 'IOS'] },
    ])
    expect(result.warnings).toEqual([])
  })

  it('takes the value from a base profile through "extends"', () => {
    const result = devClientProfiles({
      build: {
        base: { developmentClient: true },
        middle: { extends: 'base', distribution: 'internal' },
        simulator: { extends: 'middle', ios: { simulator: true } },
        release: { extends: 'base', developmentClient: false },
      },
    })

    expect(result.profiles.map((profile) => profile.name)).toEqual([
      'base',
      'middle',
      'simulator',
    ])
  })

  it('lets a platform block override the common value', () => {
    const result = devClientProfiles({
      build: {
        iosOnly: { ios: { developmentClient: true } },
        notAndroid: {
          developmentClient: true,
          android: { developmentClient: false },
        },
      },
    })

    expect(result.profiles).toEqual([
      { name: 'iosOnly', platforms: ['IOS'] },
      { name: 'notAndroid', platforms: ['IOS'] },
    ])
  })

  it('merges a platform block of the base with the platform block of the child', () => {
    const result = devClientProfiles({
      build: {
        base: { android: { developmentClient: true, buildType: 'apk' } },
        child: { extends: 'base', android: { image: 'latest' } },
      },
    })

    expect(result.profiles).toEqual([
      { name: 'base', platforms: ['ANDROID'] },
      { name: 'child', platforms: ['ANDROID'] },
    ])
  })

  it('skips a profile that extends a missing profile, and keeps the others', () => {
    const result = devClientProfiles({
      build: {
        broken: { extends: 'nothing', developmentClient: true },
        development: { developmentClient: true },
      },
    })

    expect(result.profiles.map((profile) => profile.name)).toEqual([
      'development',
    ])
    expect(result.warnings).toEqual([
      'The build profile "broken" is skipped: it extends "nothing", and eas.json has no build profile with that name.',
    ])
  })

  it('skips a profile with an "extends" cycle', () => {
    const result = devClientProfiles({
      build: {
        a: { extends: 'b', developmentClient: true },
        b: { extends: 'a' },
      },
    })

    expect(result.profiles).toEqual([])
    expect(result.warnings).toHaveLength(2)
    expect(result.warnings[0]).toContain('has a cycle')
  })

  it('accepts a chain of 5 profiles, the same limit as eas-cli', () => {
    const result = devClientProfiles({
      build: {
        p1: { developmentClient: true },
        p2: { extends: 'p1' },
        p3: { extends: 'p2' },
        p4: { extends: 'p3' },
        p5: { extends: 'p4' },
        p6: { extends: 'p5' },
      },
    })

    expect(result.profiles.map((profile) => profile.name)).toEqual([
      'p1',
      'p2',
      'p3',
      'p4',
      'p5',
    ])
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('"p6"')
  })

  it.each([[{}], [{ build: [] }], [null], [{ build: 'x' }]])(
    'finds no profiles in %j',
    (easJson) => {
      expect(devClientProfiles(easJson)).toEqual({
        profiles: [],
        warnings: [],
      })
    },
  )
})

describe('withExtraProfiles', () => {
  it('adds a profile for both platforms, once', () => {
    const profiles = withExtraProfiles(
      [{ name: 'development', platforms: ['IOS'] }],
      ['preview', 'development', 'preview'],
    )

    expect(profiles).toEqual([
      { name: 'development', platforms: ['ANDROID', 'IOS'] },
      { name: 'preview', platforms: ['ANDROID', 'IOS'] },
    ])
  })
})

describe('parseEasJson', () => {
  it('reads JSON5, the same as eas-cli', () => {
    const value = parseEasJson(`{
      // The dev client.
      build: {
        development: { developmentClient: true, },
      },
    }`)

    expect(devClientProfiles(value).profiles).toEqual([
      { name: 'development', platforms: ['ANDROID', 'IOS'] },
    ])
  })

  it('rejects a file that is not JSON5', () => {
    expect(() => parseEasJson('{ build: ')).toThrow(EasJsonError)
  })
})

describe('eas.json on disk', () => {
  const tempDir = useTempDir()

  it('finds the project in a parent folder', async () => {
    const project = await writeProject(path.join(await tempDir(), 'app'), {
      build: {},
    })
    const nested = path.join(project, 'src', 'screens')
    await mkdir(nested, { recursive: true })

    const found = await findEasProject(nested)

    expect(found).toBeDefined()
    expect(path.basename(found ?? '')).toBe('app')
  })

  it('finds no project when no folder has an eas.json', async () => {
    const dir = await tempDir()
    await writeFile(path.join(dir, 'package.json'), '{}')

    // The temporary folder of the OS has no eas.json above it.
    expect(await findEasProject(dir)).toBeUndefined()
  })

  it('gives the next step when eas.json is missing', async () => {
    await expect(readEasJson(await tempDir())).rejects.toThrow(
      'Run devhub sync in the folder of an EAS project.',
    )
  })
})
