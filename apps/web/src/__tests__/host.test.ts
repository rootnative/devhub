import { describe, expect, it } from 'vitest'
import { resolveHost } from '../logic/host'

describe('resolveHost', () => {
  it('takes the host from a fragment with a token', () => {
    expect(resolveHost('#token=abc&host=desktop', null)).toBe('desktop')
    expect(resolveHost('#host=desktop&token=abc', 'browser')).toBe('desktop')
  })

  it('gives the browser for a new run that names no host', () => {
    expect(resolveHost('#token=abc', 'desktop')).toBe('browser')
    expect(resolveHost('#token=abc&host=other', 'desktop')).toBe('browser')
  })

  it('uses the stored host when the fragment has no token', () => {
    expect(resolveHost('', 'desktop')).toBe('desktop')
    expect(resolveHost('#host=browser', 'desktop')).toBe('desktop')
    expect(resolveHost('', 'browser')).toBe('browser')
  })

  it('gives the browser with no value', () => {
    expect(resolveHost('', null)).toBe('browser')
    expect(resolveHost('', 'other')).toBe('browser')
  })
})
