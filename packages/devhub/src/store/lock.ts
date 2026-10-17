import { mkdir, open, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { isErrnoException } from './files'

export class StoreLockedError extends Error {
  constructor(readonly pid: number) {
    super(
      `Another devhub sync runs now (process ${pid}). Wait for it to finish, and then run the command again.`,
    )
    this.name = 'StoreLockedError'
  }
}

export type StoreLock = { release: () => Promise<void> }

/**
 * Takes the sync lock of the store. A sync replaces each incomplete build
 * folder, so a second sync at the same time can delete a download that the
 * first sync still writes. A lock of a process that no longer runs is stale,
 * and this function takes it.
 */
export async function acquireSyncLock(home: string): Promise<StoreLock> {
  await mkdir(home, { recursive: true })
  const file = path.join(home, 'sync.lock')
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await open(file, 'wx')
      await handle.writeFile(`${process.pid}\n`, 'utf8')
      await handle.close()
      return { release: () => rm(file, { force: true }) }
    } catch (error) {
      if (!isErrnoException(error) || error.code !== 'EEXIST') {
        throw error
      }
    }
    const pid = await readLockPid(file)
    if (pid !== undefined && isRunning(pid)) {
      throw new StoreLockedError(pid)
    }
    await rm(file, { force: true })
  }
  throw new Error(
    `DevHub cannot take the sync lock at ${file}. Delete the file if no devhub sync runs, and then run the command again.`,
  )
}

async function readLockPid(file: string): Promise<number | undefined> {
  try {
    const pid = Number.parseInt(await readFile(file, 'utf8'), 10)
    return Number.isInteger(pid) && pid > 0 ? pid : undefined
  } catch {
    return undefined
  }
}

function isRunning(pid: number): boolean {
  if (pid === process.pid) {
    return true
  }
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    // EPERM: the process runs, but it belongs to a different user.
    return isErrnoException(error) && error.code === 'EPERM'
  }
}
