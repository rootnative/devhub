import { randomBytes } from 'node:crypto'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'

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

export function isErrnoException(
  error: unknown,
): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
