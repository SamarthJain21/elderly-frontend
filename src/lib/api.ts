import { auth } from './firebase'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Calls the backend via the Vite /api proxy with the current user's Firebase ID token. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const user = auth.currentUser
  if (user === null) throw new ApiError(401, 'Not signed in')

  const token = await user.getIdToken()
  const res = await fetch(`/api${path}`, {
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
  return (await res.json()) as T
}
