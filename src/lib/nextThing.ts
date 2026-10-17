import type { FamilyMessage, Reminder } from './types'

export type NextThing = { kind: 'reply' } | { kind: 'meds' } | null

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

/**
 * The one thing worth a big button on the chat screen right now — or nothing. Rules, not AI: predictable and instant.
 *  1. the family's latest message is still unanswered → "Reply to Priya"
 *  2. a medicine reminder is due (30 min before … 1 h after) → "I took my medicine"
 */
export function nextThing(family: FamilyMessage[], reminders: Reminder[], now = new Date()): NextThing {
  const lastFamily = [...family].reverse().find(m => m.sender === 'caretaker')
  if (lastFamily && !family.slice(family.indexOf(lastFamily) + 1).some(m => m.sender === 'elder')) return { kind: 'reply' }
  const today = DAYS[now.getDay()], date = now.toISOString().slice(0, 10)
  const at = now.getHours() * 60 + now.getMinutes()
  const due = reminders.some(r => r.active && r.kind === 'medication' && (r.days?.includes(today) || r.date === date)
    && at >= mins(r.time) - 30 && at <= mins(r.time) + 60)
  return due ? { kind: 'meds' } : null
}
