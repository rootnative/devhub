import { findFolderWith } from '../store/files'

/**
 * Finds the project folder: the start folder, or the nearest parent folder,
 * that has a package.json. Expo CLI and eas-cli find the project root in the
 * same way. Returns the real path.
 */
export function findProjectRoot(start: string): Promise<string | undefined> {
  return findFolderWith(start, 'package.json')
}
