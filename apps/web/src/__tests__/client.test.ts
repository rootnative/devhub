import { describe, expect, it } from 'vitest'
import { NO_ANSWER, TOKEN_REFUSED, getJson, type Fetcher } from '../api/client'

function answer(status: number, body: unknown): Fetcher {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) {
        throw new SyntaxError('Unexpected end of JSON input')
      }
      return body
    },
  })
}

describe('getJson', () => {
  it('sends the token, and returns the JSON', async () => {
    const calls: unknown[] = []
    const fetcher: Fetcher = async (input, init) => {
      calls.push([input, init])
      return answer(200, { builds: [] })(input, init)
    }

    expect(await getJson('/api/builds', 'abc', fetcher)).toEqual({
      kind: 'ok',
      value: { builds: [] },
    })
    expect(calls).toEqual([
      ['/api/builds', { headers: { Authorization: 'Bearer abc' } }],
    ])
  })

  it('tells the user to open the printed URL for a 401', async () => {
    expect(
      await getJson('/api/builds', 'old', answer(401, { error: 'x' })),
    ).toEqual({ kind: 'error', message: TOKEN_REFUSED })
  })

  it('shows the message of the CLI for a failure', async () => {
    expect(
      await getJson(
        '/api/builds',
        'abc',
        answer(422, { error: 'DevHub cannot read projects.json.' }),
      ),
    ).toEqual({ kind: 'error', message: 'DevHub cannot read projects.json.' })
  })

  it('gives the status when the body has no message', async () => {
    expect(await getJson('/api/builds', 'abc', answer(502, undefined))).toEqual(
      { kind: 'error', message: 'DevHub answered with HTTP 502.' },
    )
  })

  it('says that DevHub does not answer when the request fails', async () => {
    const down: Fetcher = async () => {
      throw new TypeError('Failed to fetch')
    }

    expect(await getJson('/api/builds', 'abc', down)).toEqual({
      kind: 'error',
      message: NO_ANSWER,
    })
  })
})
