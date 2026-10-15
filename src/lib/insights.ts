/**
 * Demo-mode mirror of app/insights.py (live mode always uses the backend's result).
 * Same rules: per-signal 7-day personal baseline, drift after 2+ consecutive off days.
 */
import type { CheckInRecord, Drift, Insights, InsightSignal, InsightWeek } from './types'

const MOOD = { great: 5, good: 4, okay: 3, low: 2, bad: 1 } as const
const SLEEP = { well: 3, okay: 2, poorly: 1 } as const
const WORDS: Record<InsightSignal, string> = {
  mood: 'mood lower than usual', sleep: 'sleeping worse than usual', medication: 'medicines missed', checkins: 'daily check-in missed',
}
const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000)
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

function value(c: CheckInRecord | undefined, s: InsightSignal): number | null {
  if (s === 'checkins') return c?.status === 'done' ? 1 : 0
  if (!c) return null
  if (s === 'mood') return c.mood ? MOOD[c.mood] : null
  if (s === 'sleep') return c.sleepQuality ? SLEEP[c.sleepQuality] : null
  return c.medicationTaken === null ? null : c.medicationTaken ? 1 : 0
}

function off(v: number, base: number, s: InsightSignal): boolean {
  if (s === 'mood') return v <= base - 1 || v <= 2
  if (s === 'sleep') return v <= base - 1 || v === 1
  return v < 0.5 && base >= 0.5
}

export function demoInsights(history: CheckInRecord[], today = new Date()): Insights {
  const byDay = new Map(history.map(c => [c.date, c]))
  const doneToday = byDay.get(iso(today))?.status === 'done'
  const end = doneToday ? today : addDays(today, -1)
  const window = Array.from({ length: 14 }, (_, i) => iso(addDays(end, i - 13)))  // oldest → newest
  const drifts: Drift[] = []
  for (const s of ['mood', 'sleep', 'medication', 'checkins'] as InsightSignal[]) {
    const vals = window.map(d => value(byDay.get(d), s))
    let run = 0
    for (let i = vals.length - 1; i >= 0; i--) {
      const v = vals[i]
      const base = vals.slice(Math.max(0, i - 7), i).filter((x): x is number => x !== null)
      if (v === null || base.length < 3 || !off(v, mean(base), s)) break
      run++
    }
    if (run >= 2) drifts.push({ signal: s, days: run, since: window[window.length - run], detail: `${WORDS[s]} for ${run} days` })
  }
  const lastWeek = window.slice(-7).map(d => byDay.get(d)).filter((c): c is CheckInRecord => c?.status === 'done')
  const moods = lastWeek.flatMap(c => (c.mood ? [MOOD[c.mood]] : []))
  const meds = lastWeek.flatMap(c => (c.medicationTaken === null ? [] : [c.medicationTaken]))
  const sleeps = lastWeek.flatMap(c => (c.sleepQuality ? [c.sleepQuality] : []))
  const week: InsightWeek = {
    days: 7, checkinsDone: lastWeek.length, moodAvg: moods.length ? Math.round(mean(moods) * 10) / 10 : null, moodTrend: null,
    medsTakenPct: meds.length ? Math.round((100 * meds.filter(Boolean).length) / meds.length) : null,
    sleptWellPct: sleeps.length ? Math.round((100 * sleeps.filter(x => x === 'well').length) / sleeps.length) : null,
    concerns: [...new Set(lastWeek.flatMap(c => c.anomalies))].slice(0, 6),
  }
  const serious = drifts.some(d => d.signal === 'medication' || d.signal === 'checkins' || d.days >= 3)
  const status = serious && drifts.length >= 2 ? 'concern' : drifts.length ? 'watch' : 'stable'
  return { status, drifts, week, summary: null }
}
