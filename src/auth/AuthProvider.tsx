import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { api, ApiError } from '../lib/api'
import { AuthContext, type AuthState, type Me } from './AuthContext'

async function resolve(user: User | null): Promise<AuthState> {
  if (user === null) return { status: 'signedOut' }
  try {
    const me = await api<Me>('/me')
    return { status: 'ready', user, me }
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return { status: 'needsOnboarding', user }
    return { status: 'error', message: err instanceof Error ? err.message : 'Sign-in failed' }
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  useEffect(() => {
    let current = true
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setState({ status: 'loading' })
      void resolve(user).then((next) => {
        if (current) setState(next)
      })
    })
    return () => {
      current = false
      unsubscribe()
    }
  }, [])

  const refresh = useCallback(async () => {
    setState(await resolve(auth.currentUser))
  }, [])

  const signOut = useCallback(() => fbSignOut(auth), [])

  const value = useMemo(() => ({ state, refresh, signOut }), [state, refresh, signOut])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
