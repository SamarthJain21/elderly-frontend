import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../data/live'
import type { UsageReport } from '../data/api'
import { useDemo } from '../data/store'
import { isLive, switchMode } from '../data/mode'

/** /admin — what Elderly spends on Google APIs, per day and per service (estimates; Cloud Billing is the truth). */
const SERVICES: [string, string, string][] = [
  ['gemini-flash-lite', 'Gemini Flash-Lite', 'tokens'], ['gemini-flash', 'Gemini Flash (fallback)', 'tokens'],
  ['tts-chirp3-hd', 'Voice (Text-to-Speech)', 'chars'], ['places-autocomplete', 'Address search', 'calls'], ['places-details', 'Address details', 'calls'],
]
const PURPOSES = ['chat', 'hinglish-voice', 'medicine-check']
const usd = (n: number) => n < 0.01 && n > 0 ? '< $0.01' : `$${n.toFixed(2)}`
const num = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n)

export function AdminUsage() {
  const s = useDemo()
  const [days, setDays] = useState(14)
  const [r, setR] = useState<UsageReport | null>(null)
  const [err, setErr] = useState('')
  // Any signed-in account: an admin needn't have set anyone up (the server checks the email).
  const ready = isLive() && ['ready', 'needsOnboarding', 'needsElder'].includes(s.live.status)
  useEffect(() => { if (ready) api.adminUsage(days).then(setR, e => setErr((e as Error).message)) }, [ready, days])

  if (!isLive()) return <Shell><p>Sign in to see costs. <button className="linkish" onClick={() => switchMode('live', '/login?next=/admin')}>Sign in</button></p></Shell>
  if (s.live.status === 'signedOut') return <Shell><p><Link to="/login?next=/admin">Sign in</Link> with an admin account.</p></Shell>
  if (err) return <Shell><p className="err">{err === 'Admins only' ? 'This page is for admins only.' : err}</p></Shell>
  if (!r) return <Shell><div className="spinner" /></Shell>

  const totals: Record<string, number> = {}
  for (const d of r.days) for (const [k, v] of Object.entries(d.counts)) totals[k] = (totals[k] ?? 0) + v
  const svcCost: Record<string, number> = {}
  for (const d of r.days) for (const [k, v] of Object.entries(d.costUsd)) svcCost[k] = (svcCost[k] ?? 0) + v
  const max = Math.max(0.0001, ...r.days.map(d => d.totalUsd))
  return (
    <Shell>
      <div className="row" style={{ alignItems: 'baseline', flexWrap: 'wrap', gap: 12 }}>
        <div className="grow"><p className="eyebrow">Estimated spend · last {days} days</p><p className="admin-total">{usd(r.totalUsd)}</p></div>
        <div className="segbar">{[7, 14, 30].map(n => <button key={n} className={days === n ? 'on' : ''} onClick={() => { setR(null); setDays(n) }}>{n} days</button>)}</div>
      </div>
      <div className="card"><p className="eyebrow">Per day</p>
        <div className="admin-bars">{[...r.days].reverse().map(d => (
          <div key={d.date} className="admin-bar" title={`${d.date}: ${usd(d.totalUsd)}`}>
            <span style={{ height: `${Math.max(2, (d.totalUsd / max) * 100)}%` }} /><small>{d.date.slice(8)}</small>
          </div>
        ))}</div>
      </div>
      <div className="card"><p className="eyebrow">Per service</p>
        <table className="admin-table"><thead><tr><th>Service</th><th>Usage</th><th>Est. cost</th></tr></thead><tbody>
          {SERVICES.map(([k, label, unit]) => {
            const used = unit === 'tokens' ? (totals[`${k}|in`] ?? 0) + (totals[`${k}|out`] ?? 0) : totals[`${k}|${unit}`] ?? 0
            return <tr key={k}><td>{label}</td><td>{num(used)} {unit}{unit === 'tokens' ? ` · ${num(totals[`${k}|calls`] ?? 0)} calls` : ''}</td><td>{usd(svcCost[k] ?? 0)}</td></tr>
          })}
        </tbody></table>
        <p className="small muted" style={{ marginTop: 8 }}>Gemini calls by purpose: {PURPOSES.map(p => `${p} ${num(totals[`purpose:${p}|calls`] ?? 0)}`).join(' · ')}</p>
      </div>
      <p className="small muted">{r.note} Assumed rates (USD): Gemini Flash-Lite ${r.prices['gemini-flash-lite'].in}/${r.prices['gemini-flash-lite'].out} per 1M tokens in/out,
        Flash ${r.prices['gemini-flash'].in}/${r.prices['gemini-flash'].out}, voice ${r.prices['tts-chirp3-hd'].chars} per 1M characters,
        address search ${r.prices['places-autocomplete'].calls} and details ${r.prices['places-details'].calls} per 1,000.</p>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh' }}>
      <div className="topbar"><Link to="/" className="brand"><span className="logo">♥</span>Elderly</Link><span className="grow" /><b>Admin · API costs</b></div>
      <div className="launch stack" style={{ gap: 16 }}>{children}</div>
    </div>
  )
}
