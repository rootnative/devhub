import { describe, expect, it } from 'vitest'
import {
  NO_TINT,
  clearColor,
  endTint,
  tintRows,
  tintToken,
} from '../logic/tint'

describe('tintRows and tintToken', () => {
  it('gives each new set of rows a new token', () => {
    const first = tintRows(NO_TINT, ['a', 'b'])
    const second = tintRows(first, ['a'])

    expect(first).toEqual({ ids: ['a', 'b'], token: 1 })
    expect(second).toEqual({ ids: ['a'], token: 2 })
  })

  it('gives the token to a tinted row only', () => {
    const tint = tintRows(NO_TINT, ['a'])

    expect(tintToken(tint, 'a')).toBe(1)
    expect(tintToken(tint, 'b')).toBeUndefined()
    expect(tintToken(NO_TINT, 'a')).toBeUndefined()
  })
})

describe('endTint', () => {
  it('ends the tint of its token', () => {
    expect(endTint(tintRows(NO_TINT, ['a']), 1)).toEqual({ ids: [], token: 1 })
  })

  it('keeps a later tint', () => {
    const later = tintRows(tintRows(NO_TINT, ['a']), ['b'])

    expect(endTint(later, 1)).toBe(later)
  })

  it('returns the same value when no row has the tint', () => {
    expect(endTint(NO_TINT, 0)).toBe(NO_TINT)
  })
})

describe('clearColor', () => {
  it('keeps the color of a hex value, with no opacity', () => {
    expect(clearColor('#fdf0d5')).toBe('rgba(253, 240, 213, 0)')
  })

  it('keeps the color of an rgba value, with no opacity', () => {
    expect(clearColor('rgba(251, 191, 36, 0.14)')).toBe('rgba(251, 191, 36, 0)')
    expect(clearColor('rgb(1, 2, 3)')).toBe('rgba(1, 2, 3, 0)')
  })

  it('gives transparent black for another format', () => {
    expect(clearColor('amber')).toBe('rgba(0, 0, 0, 0)')
  })
})
