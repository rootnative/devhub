import spawn from 'cross-spawn'

export type Command = readonly [program: string, ...args: string[]]

export type CommandResult = {
  code: number | null
  stdout: string
  stderr: string
}

export type CommandOptions = {
  cwd: string
  env?: NodeJS.ProcessEnv
}

export type CommandRunner = (
  command: Command,
  options: CommandOptions,
) => Promise<CommandResult>

/**
 * Runs a command array with no shell. On Windows, a program such as `eas` is
 * a `.cmd` file, and Node refuses to spawn it without a shell. cross-spawn
 * runs it through `cmd.exe` and escapes each argument, so a space or a quote
 * in an argument cannot change the command.
 *
 * The promise rejects only when the program cannot start, for example with
 * the code `ENOENT`. A non-zero exit code resolves with `code` set.
 */
export const runCommand: CommandRunner = (command, options) =>
  new Promise((resolve, reject) => {
    const [program, ...args] = command
    const child = spawn(program, args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    child.stdout?.on('data', (chunk: Buffer) => stdout.push(chunk))
    child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk))
    child.on('error', reject)
    child.on('close', (code) =>
      resolve({
        code,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      }),
    )
  })
