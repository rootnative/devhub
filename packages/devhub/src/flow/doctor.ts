import { access, constants, stat } from 'node:fs/promises'
import path from 'node:path'
import {
  outputTail,
  type Command,
  type CommandRunner,
} from '../command/run-command'
import {
  ADB_MISSING,
  adbVersionCommand,
  parseAdbVersion,
  resolveAdb,
} from '../devices/android'
import { DeviceError, runTool } from '../devices/device'
import {
  XCODE_FIX,
  parseXcodeVersion,
  xcodeVersionCommand,
} from '../devices/ios'
import { scanStore } from '../store/builds'
import { isErrnoException } from '../store/files'
import { resolveHome } from '../store/home'
import { whoami } from './whoami'

/** The `engines.node` of the package. A test keeps the two the same. */
export const NODE_MINIMUM = '20.19.0'

export type DoctorCheckId = 'node' | 'store' | 'eas' | 'android' | 'ios'

/**
 * `warn`: one feature does not work. `fail`: no feature works. `skip`: the
 * check does not apply to this system.
 */
export type DoctorStatus = 'ok' | 'warn' | 'fail' | 'skip'

export type DoctorCheck = {
  id: DoctorCheckId
  /** For example "Node" or "Android". */
  label: string
  status: DoctorStatus
  /** What DevHub found, for example "Node 24.11.0". */
  detail: string
  /** With `warn` and `fail`: what is wrong, the fix, and what needs it. */
  fix?: string
}

/** The JSON of `devhub doctor --json`. */
export type DoctorReport = { checks: DoctorCheck[] }

export type DoctorDeps = {
  run: CommandRunner
  env: NodeJS.ProcessEnv
  platform: NodeJS.Platform
  homedir: string
  cwd: string
  /** The version of the Node that runs DevHub, for example `24.11.0`. */
  nodeVersion: string
}

/**
 * Checks the tools and the store that DevHub uses on this machine. The
 * checks run at the same time. Only the EAS check can use the network.
 */
export async function doctor(deps: DoctorDeps): Promise<DoctorReport> {
  const checks = await Promise.all([
    checkNode(deps.nodeVersion),
    checkStore(deps),
    checkEas(deps),
    checkAndroid(deps),
    checkIos(deps),
  ])
  return { checks }
}

/** `true` when no check is `fail`. The CLI exit code is `1` otherwise. */
export function doctorPassed(report: DoctorReport): boolean {
  return report.checks.every((check) => check.status !== 'fail')
}

/** Compares two dotted versions, for example `20.19.0` and `20.9.1`. */
export function isAtLeast(version: string, minimum: string): boolean {
  const parts = (text: string) =>
    text
      .replace(/^v/, '')
      .split(/[.+-]/)
      .slice(0, 3)
      .map((part) => Number.parseInt(part, 10) || 0)
  const have = parts(version)
  const need = parts(minimum)
  for (let index = 0; index < 3; index++) {
    const a = have[index] ?? 0
    const b = need[index] ?? 0
    if (a !== b) {
      return a > b
    }
  }
  return true
}

function checkNode(nodeVersion: string): DoctorCheck {
  const detail = `Node ${nodeVersion}`
  if (isAtLeast(nodeVersion, NODE_MINIMUM)) {
    return { id: 'node', label: 'Node', status: 'ok', detail }
  }
  return {
    id: 'node',
    label: 'Node',
    status: 'fail',
    detail,
    fix: `DevHub needs Node ${NODE_MINIMUM} or later. Install a newer Node, and then run devhub doctor again.`,
  }
}

async function checkStore(deps: DoctorDeps): Promise<DoctorCheck> {
  const home = resolveHome(deps)
  const where = deps.env.DEVHUB_HOME ? `${home} (from DEVHUB_HOME)` : home
  const fail = (fix: string): DoctorCheck => ({
    id: 'store',
    label: 'Store',
    status: 'fail',
    detail: where,
    fix,
  })
  const noWrite = (folder: string) =>
    fail(
      `DevHub cannot write to ${folder}. Give your user write access to the folder, or set DEVHUB_HOME to a folder that you can write to.`,
    )

  let isFolder: boolean
  try {
    isFolder = (await stat(home)).isDirectory()
  } catch (error) {
    if (!isErrnoException(error) || error.code !== 'ENOENT') {
      throw error
    }
    const parent = await nearestFolder(path.dirname(home))
    if (parent === undefined || !(await isWritable(parent))) {
      return noWrite(parent ?? path.dirname(home))
    }
    return {
      id: 'store',
      label: 'Store',
      status: 'ok',
      detail: `${where}. The first sync or local build makes the folder.`,
    }
  }
  if (!isFolder) {
    return fail(
      `${home} is a file, not a folder. Move the file, or set DEVHUB_HOME to a different folder.`,
    )
  }
  if (!(await isWritable(home))) {
    return noWrite(home)
  }

  const scan = await scanStore(home)
  const count = scan.builds.length
  const detail = `${where}, ${count} ${count === 1 ? 'build' : 'builds'}`
  if (scan.unreadable.length > 0) {
    const n = scan.unreadable.length
    return {
      id: 'store',
      label: 'Store',
      status: 'warn',
      detail,
      fix: `DevHub cannot read the record of ${n} stored ${n === 1 ? 'build' : 'builds'}. Run devhub list to see the reason for each one.`,
    }
  }
  return { id: 'store', label: 'Store', status: 'ok', detail }
}

async function checkEas(deps: DoctorDeps): Promise<DoctorCheck> {
  const report = await whoami({ run: deps.run, cwd: deps.cwd })
  const how = report.cli === 'eas' ? 'eas on PATH' : 'npx --yes eas-cli'
  const needs = 'devhub sync needs eas-cli with a login.'
  switch (report.state) {
    case 'signed-in':
      return {
        id: 'eas',
        label: 'EAS',
        status: 'ok',
        detail:
          report.user === undefined
            ? `Signed in (${how})`
            : `Signed in as ${report.user} (${how})`,
      }
    case 'signed-out':
      return {
        id: 'eas',
        label: 'EAS',
        status: 'warn',
        detail: `Not signed in (${how})`,
        fix: report.message ?? needs,
      }
    case 'no-cli':
      return {
        id: 'eas',
        label: 'EAS',
        status: 'warn',
        detail: 'eas-cli does not start',
        fix: report.message ?? needs,
      }
    case 'failed':
      return {
        id: 'eas',
        label: 'EAS',
        status: 'warn',
        detail: `The login check failed (${how})`,
        fix: `${report.message ?? ''}\n${needs}`.trim(),
      }
  }
}

async function checkAndroid(deps: DoctorDeps): Promise<DoctorCheck> {
  const adb = resolveAdb(deps)
  const needs = 'Android installs need adb.'
  const where = adb === 'adb' ? 'adb on PATH' : adb
  const result = await runCheckTool(
    deps,
    adbVersionCommand(adb),
    `${ADB_MISSING} ${needs}`,
  )
  if (result.kind === 'missing') {
    return {
      id: 'android',
      label: 'Android',
      status: 'warn',
      detail: 'adb not found',
      fix: result.message,
    }
  }
  if (result.code !== 0) {
    return {
      id: 'android',
      label: 'Android',
      status: 'warn',
      detail: where,
      fix: `"adb version" failed with exit code ${result.code}. Install the Android SDK Platform-Tools again with Android Studio. ${needs}${outputTail(result.stderr)}`,
    }
  }
  const version = parseAdbVersion(result.stdout)
  return {
    id: 'android',
    label: 'Android',
    status: 'ok',
    detail:
      version === undefined ? where : `Platform-Tools ${version}, ${where}`,
  }
}

async function checkIos(deps: DoctorDeps): Promise<DoctorCheck> {
  if (deps.platform !== 'darwin') {
    return {
      id: 'ios',
      label: 'iOS',
      status: 'skip',
      detail: 'iOS simulators need macOS.',
    }
  }
  const needs = 'iOS simulator installs need Xcode.'
  const result = await runCheckTool(
    deps,
    xcodeVersionCommand(),
    `DevHub cannot find xcodebuild. ${XCODE_FIX} ${needs}`,
  )
  if (result.kind === 'missing') {
    return {
      id: 'ios',
      label: 'iOS',
      status: 'warn',
      detail: 'Xcode not found',
      fix: result.message,
    }
  }
  if (result.code !== 0) {
    return {
      id: 'ios',
      label: 'iOS',
      status: 'warn',
      detail: 'Xcode not selected',
      fix: `"xcodebuild -version" failed with exit code ${result.code}. ${XCODE_FIX} ${needs}${outputTail(result.stderr)}`,
    }
  }
  const version = parseXcodeVersion(result.stdout)
  return {
    id: 'ios',
    label: 'iOS',
    status: 'ok',
    detail: version === undefined ? 'Xcode' : `Xcode ${version}`,
  }
}

type ToolResult =
  | { kind: 'ran'; code: number | null; stdout: string; stderr: string }
  | { kind: 'missing'; message: string }

async function runCheckTool(
  deps: DoctorDeps,
  command: Command,
  missing: string,
): Promise<ToolResult> {
  try {
    const result = await runTool(deps.run, command, deps.cwd, missing)
    return { kind: 'ran', ...result }
  } catch (error) {
    if (error instanceof DeviceError) {
      return { kind: 'missing', message: error.message }
    }
    throw error
  }
}

async function nearestFolder(start: string): Promise<string | undefined> {
  let folder = start
  for (;;) {
    try {
      if ((await stat(folder)).isDirectory()) {
        return folder
      }
      return undefined
    } catch (error) {
      if (!isErrnoException(error) || error.code !== 'ENOENT') {
        throw error
      }
    }
    const parent = path.dirname(folder)
    if (parent === folder) {
      return undefined
    }
    folder = parent
  }
}

async function isWritable(folder: string): Promise<boolean> {
  try {
    await access(folder, constants.W_OK)
    return true
  } catch {
    return false
  }
}
