import { createHash, randomBytes } from 'node:crypto'
import { createReadStream } from 'node:fs'
import {
  access,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises'
import path from 'node:path'

export function tempPath(target: string): string {
  return `${target}.${process.pid}-${randomBytes(4).toString('hex')}.tmp`
}

/**
 * Writes a JSON file through a temporary file and a rename, so a reader never
 * sees half a file.
 */
export async function writeJsonAtomic(
  target: string,
  value: unknown,
): Promise<void> {
  const temp = tempPath(target)
  try {
    await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    await rename(temp, target)
  } catch (error) {
    await rm(temp, { force: true })
    throw error
  }
}

/** Returns `undefined` when the file does not exist. */
export async function readJsonFile(file: string): Promise<unknown> {
  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return undefined
    }
    throw error
  }
  return JSON.parse(text) as unknown
}

/** The size and the SHA-256 of a file, read as a stream. */
export async function hashFile(
  file: string,
): Promise<{ size: number; sha256: string }> {
  const hash = createHash('sha256')
  let size = 0
  for await (const chunk of createReadStream(file)) {
    hash.update(chunk as Buffer)
    size += (chunk as Buffer).length
  }
  return { size, sha256: hash.digest('hex') }
}

/**
 * Finds the start folder, or the nearest parent folder, that has the file.
 * Returns the real path, so that one folder has one name.
 */
export async function findFolderWith(
  start: string,
  file: string,
): Promise<string | undefined> {
  let folder = path.resolve(start)
  for (;;) {
    try {
      await access(path.join(folder, file))
      return await realpath(folder)
    } catch {
      // Not here. Try the parent folder.
    }
    const parent = path.dirname(folder)
    if (parent === folder) {
      return undefined
    }
    folder = parent
  }
}

export function isErrnoException(
  error: unknown,
): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
