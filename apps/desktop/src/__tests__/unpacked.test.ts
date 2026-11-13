import { describe, expect, it } from 'vitest'
import { unpackedPath } from '../unpacked'

const BIN = 'node_modules/@rootnative/devhub/dist/bin.js'

describe('unpackedPath', () => {
  it('moves a macOS path out of the archive', () => {
    expect(
      unpackedPath(
        `/Applications/DevHub.app/Contents/Resources/app.asar/${BIN}`,
        '/',
      ),
    ).toBe(
      `/Applications/DevHub.app/Contents/Resources/app.asar.unpacked/${BIN}`,
    )
  })

  it('moves a Windows path out of the archive', () => {
    expect(
      unpackedPath(
        'C:\\Program Files\\DevHub\\resources\\app.asar\\node_modules\\bin.js',
        '\\',
      ),
    ).toBe(
      'C:\\Program Files\\DevHub\\resources\\app.asar.unpacked\\node_modules\\bin.js',
    )
  })

  it('keeps a path of the repository', () => {
    const file = `/work/devhub/${BIN}`
    expect(unpackedPath(file, '/')).toBe(file)
  })

  it('keeps a path that is already unpacked', () => {
    const file = `/DevHub.app/Contents/Resources/app.asar.unpacked/${BIN}`
    expect(unpackedPath(file, '/')).toBe(file)
  })

  it('keeps a folder whose name only starts with app.asar', () => {
    const file = `/work/app.asar.backup/${BIN}`
    expect(unpackedPath(file, '/')).toBe(file)
  })
})
