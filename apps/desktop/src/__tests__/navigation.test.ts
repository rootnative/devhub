import { describe, expect, it } from 'vitest'
import { decideNavigation } from '../navigation'

const PAGE = 'http://127.0.0.1:51234/#token=abc'

describe('decideNavigation', () => {
  it('allows the origin of the page', () => {
    expect(decideNavigation(PAGE, 'http://127.0.0.1:51234/')).toBe('allow')
    expect(decideNavigation(PAGE, 'http://127.0.0.1:51234/#token=xyz')).toBe(
      'allow',
    )
    expect(decideNavigation(PAGE, 'http://127.0.0.1:51234/api/builds')).toBe(
      'allow',
    )
  })

  it('opens a web link to another origin in the browser', () => {
    expect(decideNavigation(PAGE, 'https://expo.dev/')).toBe('external')
    expect(decideNavigation(PAGE, 'http://127.0.0.1:51235/')).toBe('external')
    expect(decideNavigation(PAGE, 'http://localhost:51234/')).toBe('external')
  })

  it('blocks every other URL', () => {
    expect(decideNavigation(PAGE, 'file:///etc/passwd')).toBe('block')
    expect(decideNavigation(PAGE, 'javascript:alert(1)')).toBe('block')
    expect(decideNavigation(PAGE, 'devhub://sync')).toBe('block')
    expect(decideNavigation(PAGE, 'not a url')).toBe('block')
    expect(decideNavigation('not a url', 'https://expo.dev/')).toBe('block')
  })
})
