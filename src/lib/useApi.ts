import { useCallback, useEffect, useState } from 'react'
import { api } from './api'

export interface ApiResult<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
}

/** GET `path` on mount and whenever it changes. Pass null to skip. */
export function useApi<T>(path: string | null): ApiResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(path !== null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (path === null) return
    let current = true
    setLoading(true)
    setError(null)
    api<T>(path)
      .then((d) => { if (current) setData(d) })
      .catch((e: unknown) => { if (current) setError(e instanceof Error ? e.message : 'Request failed') })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [path, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { data, error, loading, reload }
}
