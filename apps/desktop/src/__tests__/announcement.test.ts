import { describe, expect, it } from 'vitest'
import { readAnnouncement } from '../announcement'

const ANNOUNCEMENT = JSON.stringify(
  { url: 'http://127.0.0.1:51234/#token=abc', port: 51234 },
  null,
  2,
)

describe('readAnnouncement', () => {
  it('reads the JSON of devhub ui --json', () => {
    expect(readAnnouncement(`${ANNOUNCEMENT}\n`)).toEqual({
      url: 'http://127.0.0.1:51234/#token=abc',
      port: 51234,
    })
  })

  it('waits while the object is not complete', () => {
    const half = ANNOUNCEMENT.slice(0, ANNOUNCEMENT.indexOf('"port"'))
    expect(readAnnouncement(half)).toBeUndefined()
    expect(readAnnouncement('')).toBeUndefined()
    expect(readAnnouncement('DevHub by Root Native runs at')).toBeUndefined()
  })

  it('reads the object when text comes before and after it', () => {
    expect(readAnnouncement(`noise\n${ANNOUNCEMENT}\nmore\n`)).toEqual({
      url: 'http://127.0.0.1:51234/#token=abc',
      port: 51234,
    })
  })

  it('refuses a URL that is not the loopback server on the port', () => {
    const wrong = (url: string, port = 51234) =>
      readAnnouncement(JSON.stringify({ url, port }))
    expect(wrong('http://localhost:51234/#token=abc')).toBeUndefined()
    expect(wrong('https://127.0.0.1:51234/')).toBeUndefined()
    expect(wrong('http://127.0.0.1:51235/#token=abc')).toBeUndefined()
    expect(wrong('http://127.0.0.1:51234/', 0)).toBeUndefined()
    expect(wrong('not a url')).toBeUndefined()
  })

  it('refuses an object with another shape', () => {
    expect(readAnnouncement('{"error":"nope"}')).toBeUndefined()
    expect(readAnnouncement('{"url":1,"port":"5"}')).toBeUndefined()
    expect(readAnnouncement('[]')).toBeUndefined()
  })
})
