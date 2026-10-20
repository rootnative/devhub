import {
  formatCommand,
  outputTail,
  type Command,
  type CommandResult,
  type CommandRunner,
} from '../command/run-command'
import { isErrnoException } from '../store/files'
import { isEasBuild, type EasBuild } from './build'

/** The highest `--limit` that `eas build:list` accepts. */
export const BUILD_LIST_PAGE_SIZE = 50

export class EasCliError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EasCliError'
  }
}

/** The program and the arguments that start eas-cli, before its subcommand. */
export type EasInvocation = Command

export const EAS_ON_PATH: EasInvocation = ['eas']

/**
 * Most developers run eas-cli with npx, with no global install. npx uses the
 * eas-cli of the project when the project has one. stdin is not a terminal,
 * so npm already installs with no question, but `--yes` does not depend on
 * that rule.
 */
export const EAS_WITH_NPX: EasInvocation = ['npx', '--yes', 'eas-cli']

export function easWhoamiCommand(eas: EasInvocation): Command {
  return [...eas, 'whoami']
}

export function easBuildListCommand(
  profile: string,
  offset: number,
  eas: EasInvocation,
): Command {
  return [
    ...eas,
    'build:list',
    '--json',
    '--non-interactive',
    '--status',
    'finished',
    '--build-profile',
    profile,
    '--limit',
    String(BUILD_LIST_PAGE_SIZE),
    '--offset',
    String(offset),
  ]
}

/**
 * Finds how to start eas-cli: `eas` on PATH, and else npx. Stops with the
 * next step when neither starts, or when eas-cli has no login.
 */
export async function checkEasLogin(
  run: CommandRunner,
  cwd: string,
): Promise<EasInvocation> {
  let eas = EAS_ON_PATH
  let result: CommandResult
  try {
    result = await run(easWhoamiCommand(eas), { cwd })
  } catch (error) {
    if (!isNotFound(error)) {
      throw error
    }
    eas = EAS_WITH_NPX
    result = await runEas(run, easWhoamiCommand(eas), cwd)
  }
  if (result.code === 0) {
    return eas
  }
  if (isNotLoggedIn(result)) {
    throw new EasCliError(
      `eas-cli has no login. Run "${formatCommand([...eas, 'login'])}" in a terminal, and then start the sync again.`,
    )
  }
  throw new EasCliError(
    `"${formatCommand(easWhoamiCommand(eas))}" failed with exit code ${result.code}.${outputTail(result.stderr)}`,
  )
}

/** eas-cli writes "Not logged in" to stdout, and an older eas-cli to stderr. */
export function isNotLoggedIn(result: CommandResult): boolean {
  return /not logged in/i.test(`${result.stdout}\n${result.stderr}`)
}

/**
 * Reads every finished build of one profile, one page at a time, until a
 * page is not full. A page with no new build also stops the loop, so a
 * changed list cannot make the loop run forever.
 */
export async function listFinishedBuilds(
  run: CommandRunner,
  cwd: string,
  profile: string,
  eas: EasInvocation,
): Promise<EasBuild[]> {
  const builds = new Map<string, EasBuild>()
  for (let offset = 0; ; offset += BUILD_LIST_PAGE_SIZE) {
    const command = easBuildListCommand(profile, offset, eas)
    const result = await runEas(run, command, cwd)
    if (result.code !== 0) {
      throw new EasCliError(
        `"${formatCommand([...eas, 'build:list'])}" failed for the build profile "${profile}" with exit code ${result.code}.${outputTail(result.stderr)}`,
      )
    }
    const page = parseBuildList(result.stdout)
    const sizeBefore = builds.size
    for (const build of page) {
      builds.set(build.id, build)
    }
    if (page.length < BUILD_LIST_PAGE_SIZE || builds.size === sizeBefore) {
      return [...builds.values()]
    }
  }
}

export function parseBuildList(stdout: string): EasBuild[] {
  let value: unknown
  try {
    value = JSON.parse(stdout)
  } catch {
    throw unreadableOutput()
  }
  if (!Array.isArray(value) || !value.every(isEasBuild)) {
    throw unreadableOutput()
  }
  return value
}

function unreadableOutput(): EasCliError {
  return new EasCliError(
    '"eas build:list" printed output that DevHub cannot read. Update eas-cli to the newest version, and then run the command again.',
  )
}

async function runEas(run: CommandRunner, command: Command, cwd: string) {
  try {
    return await run(command, { cwd })
  } catch (error) {
    if (isNotFound(error)) {
      throw new EasCliError(
        `DevHub cannot start "${command[0]}". Put "eas" or "npx" on PATH. npx is in the folder of node. Then start the sync again.`,
      )
    }
    throw error
  }
}

function isNotFound(error: unknown): boolean {
  return isErrnoException(error) && error.code === 'ENOENT'
}
