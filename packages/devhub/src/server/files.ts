import path from 'node:path'

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

/**
 * Returns the file in `root` for the URL path `pathname`, or `undefined` when
 * the path cannot be a file of the page. A path never leaves `root`.
 */
export function pageFile(root: string, pathname: string): string | undefined {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return undefined
  }
  // On Windows a backslash separates folders, and a colon opens a drive or
  // an alternate data stream. The built page has neither in a file name.
  if (/[\\:\0]/.test(decoded) || !decoded.startsWith('/')) {
    return undefined
  }
  const relative = decoded.endsWith('/') ? `${decoded}index.html` : decoded
  const base = path.resolve(root)
  const file = path.resolve(base, `.${path.posix.normalize(relative)}`)
  return file.startsWith(base + path.sep) ? file : undefined
}

export function contentType(file: string): string {
  return (
    CONTENT_TYPES[path.extname(file).toLowerCase()] ??
    'application/octet-stream'
  )
}
