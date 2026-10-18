import { stat } from 'node:fs/promises'
import {
  downloadAgainFix,
  findBuild,
  scanStore,
  type StoredBuild,
} from '../store/builds'
import { errorMessage, failure, type FlowResult } from './result'

/**
 * Finds the stored build with the ID or the unique ID prefix `query`, and
 * checks that its file exists.
 */
export async function findStoredBuild(
  home: string,
  query: string,
): Promise<FlowResult<StoredBuild>> {
  let found
  try {
    found = findBuild((await scanStore(home)).builds, query)
  } catch (error) {
    return failure(errorMessage(error))
  }
  if (found.kind === 'none') {
    return failure(
      `The store has no build with an ID that starts with "${query}". Run devhub list to see the stored builds.`,
    )
  }
  if (found.kind === 'ambiguous') {
    return failure(
      [
        `The ID "${query}" matches ${found.matches.length} stored builds:`,
        ...found.matches.map((build) => `  ${build.id}`),
        'Give more characters of the ID.',
      ].join('\n'),
    )
  }

  const { build } = found
  try {
    await stat(build.path)
  } catch {
    return failure(
      `The record of the build ${build.id} names the file ${build.path}, but the file does not exist. ${downloadAgainFix(build.path)}`,
    )
  }
  return { kind: 'ok', value: build }
}
