/**
 * "This might be wrong" checks for the routine and medicines entered during setup. Rules, not AI: every check is
 * about clock times, so code is instant, exact and explainable. They warn, never block — families know best.
 */
export interface RoutineInput {
  wake: string | null; bed: string | null
  meals: { label: string; time: string | null }[]       // breakfast, lunch, dinner (null = skipped)
  checkIns: string[]
  meds: { name: string; times: string[]; withFood: boolean }[]
}

const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
const fmt = (t: string) => t

/** Awake window as [start, end] in minutes, end may pass midnight (bed 00:30 after wake 07:00 → end 1470). */
function awake(wake: string, bed: string): [number, number] {
  const w = mins(wake), b = mins(bed)
  return [w, b > w ? b : b + 24 * 60]
}
const isAwake = (t: string, [w, b]: [number, number]) => { const x = mins(t); return (x >= w && x <= b) || (x + 1440 >= w && x + 1440 <= b) }

export function routineWarnings(r: RoutineInput): string[] {
  const out: string[] = []
  if (r.wake && r.bed) {
    const win = awake(r.wake, r.bed)
    const sleepH = (24 * 60 - (win[1] - win[0])) / 60
    if (sleepH < 5) out.push(`Only about ${Math.round(sleepH)} hours between bedtime (${fmt(r.bed)}) and waking (${fmt(r.wake)}) — is that right?`)
    if (sleepH > 12) out.push(`About ${Math.round(sleepH)} hours between bedtime (${fmt(r.bed)}) and waking (${fmt(r.wake)}) — is that right?`)
    for (const m of r.meals) if (m.time && !isAwake(m.time, win)) out.push(`${m.label} at ${m.time} is while they’re usually asleep.`)
    for (const c of r.checkIns) if (!isAwake(c, win)) out.push(`The check-in at ${c} is while they’re usually asleep — they won’t answer.`)
    for (const med of r.meds) for (const t of med.times) {
      if (!isAwake(t, win)) out.push(`${med.name || 'A medicine'} at ${t} is while they’re usually asleep.`)
    }
  }
  const timed = r.meals.filter(m => m.time) as { label: string; time: string }[]
  for (let i = 1; i < timed.length; i++) {
    if (mins(timed[i].time) <= mins(timed[i - 1].time)) out.push(`${timed[i].label} (${timed[i].time}) is before ${timed[i - 1].label.toLowerCase()} (${timed[i - 1].time}).`)
  }
  if (timed.length) {
    for (const med of r.meds.filter(x => x.withFood)) for (const t of med.times) {
      const gap = Math.min(...timed.map(m => Math.abs(mins(m.time) - mins(t))))
      if (gap > 90) out.push(`${med.name || 'A medicine'} at ${t} should be taken with food, but no meal is within 1½ hours.`)
    }
  }
  const names = r.meds.map(m => m.name.trim().toLowerCase()).filter(Boolean)
  for (const n of new Set(names)) if (names.filter(x => x === n).length > 1) out.push(`${r.meds.find(m => m.name.trim().toLowerCase() === n)!.name.trim()} is listed twice.`)
  return [...new Set(out)]
}
