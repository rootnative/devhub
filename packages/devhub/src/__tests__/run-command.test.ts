import { chmod, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { childEnv, runCommand } from '../command/run-command'
import { useTempDir } from './helpers'

const ARGS = [
  'build:list',
  'dev client',
  'it\'s "quoted"',
  'a&b|c>d',
  '%PATH%',
  '$HOME',
  '',
]

/**
 * Puts a fake `eas` on PATH that prints its arguments as JSON. On Windows it
 * is a `.cmd` file, the same as the real eas-cli.
 */
async function fakeEasOnPath(dir: string): Promise<NodeJS.ProcessEnv> {
  const script = path.join(dir, 'print-args.cjs')
  await writeFile(
    script,
    'process.stdout.write(JSON.stringify(process.argv.slice(2)))\n',
  )
  if (process.platform === 'win32') {
    await writeFile(
      path.join(dir, 'eas.cmd'),
      `@"${process.execPath}" "%~dp0print-args.cjs" %*\r\n`,
    )
  } else {
    const bin = path.join(dir, 'eas')
    await writeFile(
      bin,
      `#!/bin/sh\nexec "${process.execPath}" "${script}" "$@"\n`,
    )
    await chmod(bin, 0o755)
  }
  const pathKey =
    Object.keys(process.env).find((key) => key.toUpperCase() === 'PATH') ??
    'PATH'
  return {
    ...process.env,
    [pathKey]: `${dir}${path.delimiter}${process.env[pathKey] ?? ''}`,
  }
}

describe('runCommand', () => {
  const tempDir = useTempDir()

  it('passes each argument through unchanged, with no shell', async () => {
    const dir = await tempDir()
    const env = await fakeEasOnPath(dir)

    const result = await runCommand(['eas', ...ARGS], { cwd: dir, env })

    expect(result.stderr).toBe('')
    expect(result.code).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual(ARGS)
  })

  it('resolves with the exit code of a failed program', async () => {
    const dir = await tempDir()

    const result = await runCommand(
      [process.execPath, '-e', 'process.stderr.write("no"); process.exit(3)'],
      { cwd: dir },
    )

    expect(result).toEqual({ code: 3, stdout: '', stderr: 'no' })
  })

  it('rejects with ENOENT when the program does not exist', async () => {
    const dir = await tempDir()

    await expect(
      runCommand(['devhub-no-such-program'], { cwd: dir }),
    ).rejects.toMatchObject({ code: 'ENOENT' })
  })
})

describe('childEnv', () => {
  it('drops the npm_config_* variables of a package manager script', () => {
    expect(
      childEnv({
        PATH: '/usr/bin',
        npm_config_node_linker: 'hoisted',
        NPM_CONFIG_RECURSIVE: 'true',
        npm_lifecycle_event: 'desktop',
      }),
    ).toEqual({ PATH: '/usr/bin', npm_lifecycle_event: 'desktop' })
  })
})
