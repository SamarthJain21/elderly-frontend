import { Link } from 'react-router-dom'
import { isLive } from '../data/mode'
import { nick, type DemoState } from '../data/store'
import { demoInsights } from '../lib/insights'
import type { Insights, InsightSignal } from '../lib/types'

const STATUS = {
  stable: { cls: 'ok', label: 'Steady', ic: '🌿' },
  watch: { cls: 'warn', label: 'Keep an eye', ic: '👀' },
  concern: { cls: 'bad', label: 'Needs attention', ic: '⚠️' },
} as const

const SIGNAL_IC: Record<InsightSignal, string> = { mood: '😕', sleep: '🌙', medication: '💊', checkins: '📭' }

const PHRASE: Record<InsightSignal, string> = {
  mood: 'seemed a little low', sleep: 'been sleeping worse than usual', medication: 'missed some medicines', checkins: 'missed a few check-ins',
}

/** Demo has no model call: a plain sentence built from the same numbers. Live uses the backend's Gemini note. */
function demoNote(name: string, ins: Insights): string {
  if (!ins.drifts.length) return `${name} has been steady this week — check-ins done, mood and sleep as usual.`
  const days = Math.max(...ins.drifts.map(d => d.days))
  const what = ins.drifts.map(d => PHRASE[d.signal]).join(' and has ')
  return `${name} has ${what} for the last ${days} days. A warm call this week could help.`
}

const insightsOf = (s: DemoState): Insights | null => (isLive() ? s.insights ?? null : demoInsights(s.checkinHistory))

/** For the home headline: never "all good" above a "keep an eye" card. */
export function weekStatus(s: DemoState): { cls: 'ok' | 'warn' | 'bad'; label: string; line: string } {
  const ins = insightsOf(s)
  if (!ins || ins.status === 'stable') return { cls: 'ok', label: 'All good', line: `${s.elder.name} is at home and doing well` }
  const lead = ins.drifts[0]
  const line = lead?.signal === 'mood' ? `${s.elder.name} seems a little low this week`
    : lead?.signal === 'medication' ? `${s.elder.name} has missed some medicines`
      : lead?.signal === 'sleep' ? `${s.elder.name} hasn't been sleeping well`
        : `${s.elder.name} has missed a few check-ins`
  return ins.status === 'concern' ? { cls: 'bad', label: 'Needs attention', line } : { cls: 'warn', label: 'Keep an eye', line }
}

/**
 * Drift + weekly picture for the family (app/insights.py): a status, what changed and since when,
 * a short note, and this week's numbers. `compact` = home screen card; full = check-ins screen.
 */
export function InsightsCard({ s, compact = false }: { s: DemoState; compact?: boolean }) {
  const ins = insightsOf(s)
  if (!ins || (ins.week.checkinsDone === 0 && !ins.drifts.length)) return null
  const st = STATUS[ins.status]
  const name = nick(s)
  const note = ins.summary ?? (isLive() ? null : demoNote(name, ins))
  const w = ins.week
  const trend = w.moodTrend === 'up' ? '↗' : w.moodTrend === 'down' ? '↘' : w.moodTrend === 'flat' ? '→' : ''
  const body = (
    <>
      <div className="row" style={{ gap: 8 }}>
        <p className="eyebrow grow">This week</p>
        {/* On home the status already heads the page; here it would just repeat it. */}
        {!compact && <span className={`pill ${st.cls}`}>{st.ic} {st.label}</span>}
        {compact && <span className="small muted">Details ›</span>}
      </div>
      {ins.drifts.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'grid', gap: 6 }}>
          {ins.drifts.map(d => (
            <li key={d.signal} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
              <span aria-hidden>{SIGNAL_IC[d.signal]}</span>
              <span style={{ minWidth: 0 }}><b>{d.detail.charAt(0).toUpperCase() + d.detail.slice(1)}</b>
                <span className="small muted"> · since {new Date(d.since).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span></span>
            </li>
          ))}
        </ul>
      )}
      {note && <p style={{ margin: '10px 0 0', lineHeight: 1.45 }}>{note}</p>}
      {!compact && (
        <div className="metrics" style={{ marginTop: 12 }}>
          <div className="card metric"><p className="k">Check-ins</p><p className="v">{w.checkinsDone}<small> / 7 days</small></p></div>
          <div className="card metric"><p className="k">Mood</p><p className="v">{w.moodAvg ?? '—'}<small> / 5 {trend}</small></p></div>
          <div className="card metric"><p className="k">Medicines taken</p><p className="v">{w.medsTakenPct ?? '—'}<small>{w.medsTakenPct !== null ? '%' : ''}</small></p></div>
          <div className="card metric"><p className="k">Slept well</p><p className="v">{w.sleptWellPct ?? '—'}<small>{w.sleptWellPct !== null ? '%' : ''}</small></p></div>
        </div>
      )}
      {!compact && w.concerns.length > 0 && (
        <p className="small" style={{ marginTop: 10 }}><b>Mentioned:</b> {w.concerns.join(' · ')}</p>
      )}
    </>
  )
  const border = ins.status === 'concern' ? 'var(--sos)' : ins.status === 'watch' ? 'var(--amber)' : undefined
  return compact
    ? <Link to="/caretaker/checkins" className="card" data-tour="insights" style={{ textDecoration: 'none', color: 'inherit', display: 'block', borderColor: border }}>{body}</Link>
    : <div className="card" style={{ borderColor: border }}>{body}</div>
}
