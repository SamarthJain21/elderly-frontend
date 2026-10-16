/**
 * Live (real backend + Firebase Auth) or demo (in-browser data for the showcase).
 * `/demo`, embedded phones and any URL with `?demo` always run in demo; otherwise the saved choice, default live.
 * Decided once per page load.
 */
export type DataMode = 'live' | 'demo'
const KEY = 'elderly-mode'
const TAB_KEY = 'elderly-mode-tab'

/** Inside /try: an app frame signed in to a throwaway sandbox account on the real backend (real Gemini). */
export const SANDBOX_FRAME = typeof window !== 'undefined' && new URLSearchParams(location.search).has('sandbox')

function initialMode(): DataMode {
  if (typeof window === 'undefined') return 'demo'
  if (SANDBOX_FRAME) return 'live'
  const q = new URLSearchParams(location.search)
  // The side-by-side showcase (and its embedded phones) always uses demo data.
  if (location.pathname.startsWith('/demo') || q.has('demo') || q.has('embed') || window.self !== window.top) {
    // Remember it for this tab, so a reload mid-test stays in the demo instead of jumping to sign-in.
    try { sessionStorage.setItem(TAB_KEY, 'demo') } catch { /* ignore */ }
    return 'demo'
  }
  try {
    if (sessionStorage.getItem(TAB_KEY) === 'demo') return 'demo'
    const saved = localStorage.getItem(KEY)
    if (saved === 'live' || saved === 'demo') return saved
  } catch { /* storage blocked */ }
  return import.meta.env.VITE_DATA_MODE === 'demo' ? 'demo' : 'live'
}

export const MODE: DataMode = initialMode()
export const isLive = () => MODE === 'live'
// Production builds get VITE_API_URL from .env.production (Cloud Run). Dev uses the Vite proxy to the local backend.
export const API_URL: string = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api' : 'https://elderly-api-968215624615.asia-southeast1.run.app')

/** Switch and reload so every module starts in the new mode. */
export function switchMode(m: DataMode, to = '/') {
  try { localStorage.setItem(KEY, m); if (m === 'live') sessionStorage.removeItem(TAB_KEY); else sessionStorage.setItem(TAB_KEY, 'demo') } catch { /* ignore */ }
  location.href = to
}
