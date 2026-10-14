import { createContext, useContext } from 'react'
import type { User } from 'firebase/auth'

export type Role = 'elder' | 'caretaker'

export interface Me {
  uid: string
  email: string | null
  role: Role
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'needsOnboarding'; user: User }
  | { status: 'ready'; user: User; me: Me }
  | { status: 'error'; message: string }

export interface AuthContextValue {
  state: AuthState
  /** Re-fetch /me, e.g. after onboarding. */
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (ctx === null) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

export function homeFor(role: Role): string {
  return role === 'elder' ? '/elder' : '/caretaker'
}
