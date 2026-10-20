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
      env: childEnv(options.env ?? process.env),
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

/**
 * The environment of a child, without the `npm_config_*` variables. A
 * package manager sets them for a script that it runs, and `pnpm` sets
 * values that npm does not know. npx then writes a warning for each one to
 * stderr, and the warnings hide the real message of eas-cli.
 */
export function childEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const clean: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(env)) {
    if (!key.toLowerCase().startsWith('npm_config_')) {
      clean[key] = value
    }
  }
  return clean
}

/**
 * The command as text for a message, with an argument in quotes when it has
 * a space or a special character. DevHub never runs this text.
 */
export function formatCommand(command: Command): string {
  return command
    .map((arg) =>
      /^[\w@%+=:,./-]+$/.test(arg)
        ? arg
        : `"${arg.replace(/(["\\$`])/g, '\\$1')}"`,
    )
    .join(' ')
}

/** The last lines of a command output, on a new line, or an empty string. */
export function outputTail(output: string, count = 5): string {
  const lines = output.trim().split(/\r?\n/).slice(-count).join('\n')
  return lines ? `\n${lines}` : ''
}
