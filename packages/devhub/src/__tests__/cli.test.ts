import { describe, expect, it } from 'vitest'
import pkg from '../../package.json' with { type: 'json' }
import { EXIT_CODE, run, type Io } from '../cli/run'

function capture() {
  const out: string[] = []
  const err: string[] = []
  const io: Io = {
    out: (text) => out.push(text),
    err: (text) => err.push(text),
  }
  return { io, out, err }
}

describe('devhub CLI', () => {
  it.each([['--version'], ['-v']])(
    '%s prints the package version',
    async (flag) => {
      const { io, out, err } = capture()

      expect(await run([flag], io)).toBe(EXIT_CODE.ok)
      expect(out).toEqual([pkg.version])
      expect(err).toEqual([])
    },
  )

  it.each([[[]], [['--help']], [['-h']]])(
    'args %j print the help',
    async (argv) => {
      const { io, out, err } = capture()

      expect(await run(argv, io)).toBe(EXIT_CODE.ok)
      expect(out.join('\n')).toContain('Usage: devhub')
      expect(err).toEqual([])
    },
  )

  it('rejects an unknown command with the usage exit code', async () => {
    const { io, out, err } = capture()

    expect(await run(['launch'], io)).toBe(EXIT_CODE.usage)
    expect(out).toEqual([])
    expect(err.join('\n')).toContain('Unknown command "launch"')
  })

  it('rejects an unknown option with the usage exit code', async () => {
    const { io, out, err } = capture()

    expect(await run(['--nope'], io)).toBe(EXIT_CODE.usage)
    expect(out).toEqual([])
    expect(err.join('\n')).toContain('devhub --help')
  })
})
