export const TOKEN_KEY = 'devhub-token'

/**
 * The token of this devhub ui run. A new URL from the terminal brings a new
 * token in the fragment, and it wins over the stored one. The page keeps the
 * token in sessionStorage, so a reload works after the fragment is gone.
 */
export function resolveToken(
  hash: string,
  stored: string | null,
): { token: string | undefined; fromHash: boolean } {
  const fromHash = new URLSearchParams(hash.replace(/^#/, '')).get('token')
  if (fromHash) {
    return { token: fromHash, fromHash: true }
  }
  return { token: stored || undefined, fromHash: false }
}
