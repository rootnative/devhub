import spawn from 'cross-spawn'
import type { Command, CommandOptions } from './run-command'

/**
 * Starts a command and does not wait for it. The promise resolves with the
 * exit code, and rejects when the program cannot start.
 */
export type CommandStarter = (
  command: Command,
  options: CommandOptions,
) => Promise<number | null>

/**
 * Starts a command that can run longer than DevHub, for example a browser
 * that `xdg-open` starts as its child. The child gets its own process group,
 * so the Ctrl+C of the terminal does not stop it, and DevHub can exit before
 * it ends.
 */
export const startCommand: CommandStarter = (command, options) =>
  new Promise((resolve, reject) => {
    const [program, ...args] = command
    const child = spawn(program, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: 'ignore',
      detached: true,
      windowsHide: true,
    })
    child.on('error', reject)
    child.on('exit', (code) => resolve(code))
    child.unref()
  })
