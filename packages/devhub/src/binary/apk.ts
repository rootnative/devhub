import { open } from 'node:fs/promises'

const END_SIGNATURE = 0x06054b50
const END_SIZE = 22
const MAX_COMMENT_SIZE = 0xffff
const ENTRY_SIGNATURE = 0x02014b50
const ENTRY_SIZE = 46
const ABI_LIBRARY = /^lib\/([^/]+)\/[^/]+\.so$/

/**
 * Returns the ABIs of the native code in an APK: the folders in `lib/` that
 * hold a `.so` file, sorted. An APK with no native code gives `[]`. It reads
 * only the central directory of the ZIP file, so the size of the APK does
 * not matter.
 */
export async function apkAbis(file: string): Promise<string[]> {
  const handle = await open(file, 'r')
  try {
    const { size } = await handle.stat()
    const tailSize = Math.min(size, END_SIZE + MAX_COMMENT_SIZE)
    const tail = await readAt(handle, size - tailSize, tailSize)
    const end = findEnd(tail)
    if (end === undefined) {
      throw notAnApk(file)
    }
    const count = tail.readUInt16LE(end + 10)
    const directorySize = tail.readUInt32LE(end + 12)
    const directoryOffset = tail.readUInt32LE(end + 16)
    if (
      count === 0xffff ||
      directorySize === 0xffffffff ||
      directoryOffset === 0xffffffff
    ) {
      throw new Error(
        `${file} is a ZIP64 file. DevHub cannot read the ABIs of a ZIP64 file.`,
      )
    }
    if (directoryOffset + directorySize > size) {
      throw notAnApk(file)
    }
    const directory = await readAt(handle, directoryOffset, directorySize)
    const abis = new Set<string>()
    let at = 0
    for (let index = 0; index < count; index++) {
      if (
        at + ENTRY_SIZE > directory.length ||
        directory.readUInt32LE(at) !== ENTRY_SIGNATURE
      ) {
        throw notAnApk(file)
      }
      const nameSize = directory.readUInt16LE(at + 28)
      const extraSize = directory.readUInt16LE(at + 30)
      const commentSize = directory.readUInt16LE(at + 32)
      const name = directory.toString(
        'utf8',
        at + ENTRY_SIZE,
        at + ENTRY_SIZE + nameSize,
      )
      const abi = ABI_LIBRARY.exec(name)?.[1]
      if (abi !== undefined) {
        abis.add(abi)
      }
      at += ENTRY_SIZE + nameSize + extraSize + commentSize
    }
    return [...abis].sort()
  } finally {
    await handle.close()
  }
}

async function readAt(
  handle: Awaited<ReturnType<typeof open>>,
  position: number,
  length: number,
): Promise<Buffer> {
  const buffer = Buffer.alloc(length)
  const { bytesRead } = await handle.read(buffer, 0, length, position)
  return buffer.subarray(0, bytesRead)
}

/** The end record is last, before a comment of at most 64 KiB. */
function findEnd(tail: Buffer): number | undefined {
  for (let at = tail.length - END_SIZE; at >= 0; at--) {
    if (tail.readUInt32LE(at) === END_SIGNATURE) {
      return at
    }
  }
  return undefined
}

function notAnApk(file: string): Error {
  return new Error(
    `${file} is not an APK. DevHub cannot read it as a ZIP file.`,
  )
}
