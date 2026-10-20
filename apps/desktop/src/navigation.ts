/**
 * What the window does with a navigation or a new window that the page
 * asks for. The page lives on one origin, the `devhub ui` server. A link to
 * another origin opens in the default browser when it is a web link, and
 * nothing happens for any other URL.
 */
export type NavigationDecision = 'allow' | 'external' | 'block'

export function decideNavigation(
  pageUrl: string,
  target: string,
): NavigationDecision {
  let page: URL
  let next: URL
  try {
    page = new URL(pageUrl)
    next = new URL(target)
  } catch {
    return 'block'
  }
  if (next.origin === page.origin) {
    return 'allow'
  }
  if (next.protocol === 'http:' || next.protocol === 'https:') {
    return 'external'
  }
  return 'block'
}
