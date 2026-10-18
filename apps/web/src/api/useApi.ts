import { useCallback, useEffect, useRef, useState } from 'react'
import { getJson, type ApiResult } from './client'

export type ApiState<T> = { kind: 'loading' } | ApiResult<T>

/**
 * Reads one API route when the page opens, and again on each `reload`. A
 * reload keeps the last result on screen until the new one arrives. Only the
 * answer to the newest request changes the state.
 */
export function useApi<T>(route: string, token: string) {
  const [state, setState] = useState<ApiState<T>>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const latest = useRef(0)

  const reload = useCallback(async () => {
    const request = ++latest.current
    setBusy(true)
    const result = await getJson<T>(route, token)
    if (request === latest.current) {
      setState(result)
      setBusy(false)
    }
  }, [route, token])

  useEffect(() => {
    void reload()
  }, [reload])

  return { state, busy, reload }
}
