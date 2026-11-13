import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { userInfo } from 'node:os'
import path from 'node:path'

export const SHELL_ENV_TIMEOUT_MS = 10_000

/**
 * An app that starts from Finder, the Dock, or a Linux launcher does not get
 * the environment of the shell profile: no `PATH` to node, npx, and eas, no
 * `ANDROID_HOME`, and no `DEVHUB_HOME`. A start from a terminal already has
 * that environment, and can set a value for one run, so it keeps its own.
 * Windows gives each app the environment of the user.
 */
export function needsShellEnv(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
): boolean {
  return platform !== 'win32' && env.TERM === undefined
}

/**
 * The login shell prints its environment between two marks. `-i` is
 * necessary, because many profiles set `PATH` (nvm, for example) and
 * `ANDROID_HOME` in the file of the interactive shell only.
 */
export function shellEnvCommand(
  shell: string,
  mark: string,
): [string, string[]] {
  const script = `printf '%s' ${mark}; /usr/bin/env -0; printf '%s' ${mark}`
  // csh and tcsh accept -l only as the single argument.
  const flags = /^t?csh$/.test(path.basename(shell))
    ? ['-i', '-c']
    : ['-i', '-l', '-c']
  return [shell, [...flags, script]]
}

/**
 * Reads the output of `env -0` between the marks. A profile can print text
 * before and after them. Returns `undefined` until both marks are there,
 * or when the environment has no `PATH`.
 */
export function readShellEnv(
  stdout: string,
  mark: string,
): Record<string, string> | undefined {
  const start = stdout.indexOf(mark)
  if (start === -1) {
    return undefined
  }
  const end = stdout.indexOf(mark, start + mark.length)
  if (end === -1) {
    return undefined
  }
  const env: Record<string, string> = {}
  for (const entry of stdout.slice(start + mark.length, end).split('\0')) {
    const equals = entry.indexOf('=')
    if (equals > 0) {
      env[entry.slice(0, equals)] = entry.slice(equals + 1)
    }
  }
  return env.PATH === undefined ? undefined : env
}

/** Runs the login shell once, and returns its environment. */
export function loginShellEnv(
  env: NodeJS.ProcessEnv,
  shell: string,
  timeoutMs = SHELL_ENV_TIMEOUT_MS,
): Promise<Record<string, string>> {
  const mark = randomUUID().replaceAll('-', '')
  const [program, args] = shellEnvCommand(shell, mark)
  return new Promise((resolve, reject) => {
    // A shell of its own process group, so a stop also stops the jobs that
    // the profile started in the background.
    const child = spawn(program, args, {
      env,
      stdio: ['ignore', 'pipe', 'ignore'],
      detached: true,
    })
    let stdout = ''
    let done = false

    const finish = (result: Record<string, string> | Error) => {
      if (done) {
        return
      }
      done = true
      clearTimeout(timer)
      if (child.exitCode === null && child.signalCode === null) {
        stopGroup(child.pid)
      }
      child.stdout.destroy()
      if (result instanceof Error) {
        reject(result)
      } else {
        resolve(result)
      }
    }

    const timer = setTimeout(
      () => finish(new Error(`it gave no environment in ${timeoutMs} ms`)),
      timeoutMs,
    )
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
      const found = readShellEnv(stdout, mark)
      if (found !== undefined) {
        finish(found)
      }
    })
    child.on('error', (error) => finish(error))
    child.on('close', (code, signal) =>
      finish(
        new Error(
          `it stopped with ${signal ?? `exit code ${code}`} and gave no environment`,
        ),
      ),
    )
  })
}

function stopGroup(pid: number | undefined): void {
  if (pid === undefined) {
    return
  }
  try {
    process.kill(-pid, 'SIGTERM')
  } catch {
    // The group has already stopped.
  }
}

/**
 * The environment for the `devhub` child. When the shell gives none, the
 * child gets the environment of the app, and the log says why.
 */
export async function childEnv(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  log: (line: string) => void,
  timeoutMs = SHELL_ENV_TIMEOUT_MS,
): Promise<NodeJS.ProcessEnv> {
  if (!needsShellEnv(platform, env)) {
    return env
  }
  const shell = loginShell(env)
  try {
    return await loginShellEnv(env, shell, timeoutMs)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    log(
      `DevHub cannot read the environment of the login shell ${shell}: ${reason}. DevHub uses the environment of the app, so it can miss eas, npx, adb, and DEVHUB_HOME.`,
    )
    return env
  }
}

function loginShell(env: NodeJS.ProcessEnv): string {
  if (env.SHELL) {
    return env.SHELL
  }
  try {
    return userInfo().shell ?? '/bin/sh'
  } catch {
    return '/bin/sh'
  }
}
