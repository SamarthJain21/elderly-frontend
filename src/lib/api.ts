import { auth } from './firebase'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Dev: the Vite proxy serves the backend at /api. Hosted: VITE_API_URL is the Cloud Run URL.
export const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '/api'

/** Calls the backend with the current user's Firebase ID token. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const user = auth.currentUser
  if (user === null) throw new ApiError(401, 'Not signed in')

  const token = await user.getIdToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  })
  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null)
    const detail =
      body !== null && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string'
        ? body.detail
        : res.statusText
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
