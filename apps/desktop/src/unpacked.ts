import path from 'node:path'

/**
 * The path of a file that the package keeps out of `app.asar`. Electron
 * resolves a module of the package to a path inside the archive, also when
 * `asarUnpack` keeps the file on disk. A path outside an archive does not
 * change, so the same code runs from the repository.
 */
export function unpackedPath(file: string, separator = path.sep): string {
  return file.replace(
    `${separator}app.asar${separator}`,
    `${separator}app.asar.unpacked${separator}`,
  )
}
