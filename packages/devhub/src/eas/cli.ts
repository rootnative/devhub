import type { Command, CommandRunner } from '../command/run-command'
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

export function easWhoamiCommand(): Command {
  return ['eas', 'whoami']
}

export function easBuildListCommand(profile: string, offset: number): Command {
  return [
    'eas',
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

/** Stops with the next step when `eas` is missing or has no login. */
export async function checkEasLogin(
  run: CommandRunner,
  cwd: string,
): Promise<void> {
  const result = await runEas(run, easWhoamiCommand(), cwd)
  if (result.code === 0) {
    return
  }
  if (/not logged in/i.test(result.stderr)) {
    throw new EasCliError(
      'eas-cli has no login. Run "eas login", and then run the command again.',
    )
  }
  throw new EasCliError(
    `"eas whoami" failed with exit code ${result.code}.${stderrTail(result.stderr)}`,
  )
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
): Promise<EasBuild[]> {
  const builds = new Map<string, EasBuild>()
  for (let offset = 0; ; offset += BUILD_LIST_PAGE_SIZE) {
    const command = easBuildListCommand(profile, offset)
    const result = await runEas(run, command, cwd)
    if (result.code !== 0) {
      throw new EasCliError(
        `"eas build:list" failed for the build profile "${profile}" with exit code ${result.code}.${stderrTail(result.stderr)}`,
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
    '"eas build:list" printed output that DevHub cannot read. Update eas-cli with "npm install --global eas-cli", and then run the command again.',
  )
}

async function runEas(run: CommandRunner, command: Command, cwd: string) {
  try {
    return await run(command, { cwd })
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      throw new EasCliError(
        'DevHub cannot find the "eas" command. Install eas-cli with "npm install --global eas-cli", and then run the command again.',
      )
    }
    throw error
  }
}

function stderrTail(stderr: string): string {
  const lines = stderr.trim().split(/\r?\n/).slice(-5).join('\n')
  return lines ? `\n${lines}` : ''
}
