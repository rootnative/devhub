import path from 'node:path'

export type HomeOptions = {
  env: NodeJS.ProcessEnv
  platform: NodeJS.Platform
  homedir: string
  cwd: string
}

/**
 * Returns the folder of the DevHub store. `DEVHUB_HOME` wins. Otherwise the
 * store goes in the data folder of the OS, never inside a project folder.
 */
export function resolveHome({
  env,
  platform,
  homedir,
  cwd,
}: HomeOptions): string {
  const p = platform === 'win32' ? path.win32 : path.posix
  const override = env.DEVHUB_HOME
  if (override) {
    return p.resolve(cwd, override)
  }
  if (platform === 'darwin') {
    return p.join(homedir, 'Library', 'Application Support', 'devhub')
  }
  if (platform === 'win32') {
    const localAppData = env.LOCALAPPDATA ?? p.join(homedir, 'AppData', 'Local')
    return p.join(localAppData, 'devhub')
  }
  // The XDG spec says to ignore a relative XDG_DATA_HOME.
  const xdgDataHome = env.XDG_DATA_HOME
  if (xdgDataHome && p.isAbsolute(xdgDataHome)) {
    return p.join(xdgDataHome, 'devhub')
  }
  return p.join(homedir, '.local', 'share', 'devhub')
}
