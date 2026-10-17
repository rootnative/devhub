import { stat } from 'node:fs/promises'
import {
  downloadAgainFix,
  findBuild,
  scanStore,
  type StoredBuild,
} from '../store/builds'
import { resolveHome } from '../store/home'
import { errorMessage, type CliContext } from './context'

/**
 * Finds the stored build with the ID or the unique ID prefix `query`, and
 * checks that its file exists. On a failure it writes the message and
 * returns `undefined`.
 */
export async function findStoredBuild(
  context: CliContext,
  query: string,
): Promise<StoredBuild | undefined> {
  const { io } = context
  let found
  try {
    found = findBuild((await scanStore(resolveHome(context))).builds, query)
  } catch (error) {
    io.err(errorMessage(error))
    return undefined
  }
  if (found.kind === 'none') {
    io.err(
      `The store has no build with an ID that starts with "${query}". Run devhub list to see the stored builds.`,
    )
    return undefined
  }
  if (found.kind === 'ambiguous') {
    io.err(
      [
        `The ID "${query}" matches ${found.matches.length} stored builds:`,
        ...found.matches.map((build) => `  ${build.id}`),
        'Give more characters of the ID.',
      ].join('\n'),
    )
    return undefined
  }

  const { build } = found
  try {
    await stat(build.path)
  } catch {
    io.err(
      `The record of the build ${build.id} names the file ${build.path}, but the file does not exist. ${downloadAgainFix(build.path)}`,
    )
    return undefined
  }
  return build
}
