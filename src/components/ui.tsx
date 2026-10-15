import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export const MicIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v4" />
  </svg>
)

const WAVE = [8, 14, 22, 12, 28, 18, 10, 24, 30, 16, 12, 20, 26, 14, 8, 18, 22, 10]
export const Wave = () => <span className="wave">{WAVE.map((h, i) => <i key={i} style={{ height: h }} />)}</span>

// ---------- toast ----------
const ToastCtx = createContext<(msg: string) => void>(() => {})
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<number>(undefined)
  const show = useCallback((m: string) => {
    setMsg(m); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setMsg(null), 2600)
  }, [])
  // Lets non-React code (the live data layer) show a toast: notify('…').
  useEffect(() => {
    const on = (e: Event) => show((e as CustomEvent<string>).detail)
    window.addEventListener('elderly-toast', on); return () => window.removeEventListener('elderly-toast', on)
  }, [show])
  return <ToastCtx.Provider value={show}>{children}{msg && <div className="toast" role="status">{msg}</div>}</ToastCtx.Provider>
}
export const useToast = () => useContext(ToastCtx)
export const notify = (msg: string) => window.dispatchEvent(new CustomEvent('elderly-toast', { detail: msg }))

/** Marks a feature the backend doesn't support yet. `card` = a full explanatory card instead of a small pill. */
export function ComingSoon({ children, card = false, title = 'Coming soon' }: { children?: ReactNode; card?: boolean; title?: string }) {
  if (!card) return <span className="soon-pill" title={typeof children === 'string' ? children : undefined}>Coming soon</span>
  return (
    <div className="soon-card" role="note">
      <span className="soon-pill">Coming soon</span>
      <p className="t">{title}</p>
      {children && <p className="s">{children}</p>}
    </div>
  )
}

// ---------- bottom sheet (scoped to the phone shell) ----------
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={e => e.stopPropagation()}>
        <div className="grab" />
        {children}
      </div>
    </div>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} aria-label={label} />
      <span />
    </label>
  )
}

export const timeAgo = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}
export const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** Fake-but-plausible QR (finder patterns + seeded modules). Mock only — real app encodes a one-time link. */
export function MockQR({ seed, size = 180 }: { seed: string; size?: number }) {
  const n = 25
  let h = 2166136261
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000 }
  const finder = (x: number, y: number) => x < 7 && y < 7 || x >= n - 7 && y < 7 || x < 7 && y >= n - 7
  const cells: ReactNode[] = []
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (finder(x, y)) continue
    if (rnd() > 0.52) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />)
  }
  const F = ({ x, y }: { x: number; y: number }) => <g><rect x={x} y={y} width="7" height="7" /><rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" /><rect x={x + 2} y={y + 2} width="3" height="3" /></g>
  return (
    <svg width={size} height={size} viewBox={`-1 -1 ${n + 2} ${n + 2}`} role="img" aria-label="Sign-in QR code" shapeRendering="crispEdges">
      <rect x="-1" y="-1" width={n + 2} height={n + 2} fill="#fff" />
      <g fill="#1D1A16">{cells}<F x={0} y={0} /><F x={n - 7} y={0} /><F x={0} y={n - 7} /></g>
    </svg>
  )
}
