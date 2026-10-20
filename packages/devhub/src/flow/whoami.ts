import type { CommandRunner } from '../command/run-command'
import {
  EAS_ON_PATH,
  EasCliError,
  easUserName,
  isNotLoggedIn,
  noLoginMessage,
  runEasWhoami,
  whoamiFailedMessage,
} from '../eas/cli'

/** The JSON of `devhub whoami --json`. */
export type WhoamiReport = {
  /**
   * `signed-in`: eas-cli runs and has a login. `signed-out`: eas-cli runs
   * and has no login. `no-cli`: neither `eas` nor `npx` starts. `failed`:
   * eas-cli started and failed for another reason, for example no network.
   */
  state: 'signed-in' | 'signed-out' | 'no-cli' | 'failed'
  /** How DevHub starts eas-cli: `eas` on PATH, or `npx --yes eas-cli`. */
  cli: 'eas' | 'npx' | 'none'
  /** The EAS user name, with the state `signed-in`. */
  user?: string
  /** What is wrong, with the fix, with each state but `signed-in`. */
  message?: string
}

export type WhoamiDeps = {
  run: CommandRunner
  cwd: string
}

/**
 * Asks eas-cli for the login state, the same way the sync does before it
 * reads the builds. The report never throws for a state that eas-cli can
 * give: the CLI and the page read the `state`.
 */
export async function whoami(deps: WhoamiDeps): Promise<WhoamiReport> {
  let answer
  try {
    answer = await runEasWhoami(deps.run, deps.cwd)
  } catch (error) {
    if (error instanceof EasCliError) {
      return { state: 'no-cli', cli: 'none', message: error.message }
    }
    throw error
  }
  const { eas, result } = answer
  const cli = eas === EAS_ON_PATH ? 'eas' : 'npx'
  if (result.code === 0) {
    const user = easUserName(result.stdout)
    return user === undefined
      ? { state: 'signed-in', cli }
      : { state: 'signed-in', cli, user }
  }
  if (isNotLoggedIn(result)) {
    return { state: 'signed-out', cli, message: noLoginMessage(eas) }
  }
  return { state: 'failed', cli, message: whoamiFailedMessage(eas, result) }
}

/** `true` when a sync can run: eas-cli has a login. */
export function canSync(report: WhoamiReport): boolean {
  return report.state === 'signed-in'
}
