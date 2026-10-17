import { describe, expect, it } from 'vitest'
import { nextThing } from './nextThing'
import type { FamilyMessage, Reminder } from './types'

const msg = (sender: FamilyMessage['sender'], id: string): FamilyMessage =>
  ({ id, sender, senderUid: 'u', senderName: 'Priya', text: 'hi', chips: [], usedChips: [], viaAgent: false, createdAt: '' })
const pill = (time: string): Reminder =>
  ({ id: 'r', elderId: 'e', title: 'Take Amlodipine', kind: 'medication', time, days: ['sat'], date: null, medicationId: 'm', active: true })
const sat = (hh: number, mm = 0) => new Date(2026, 9, 17, hh, mm)  // Saturday 17 Oct 2026

describe('nextThing (the one context button on the chat screen)', () => {
  it('offers a reply while the family’s last message is unanswered', () => {
    expect(nextThing([msg('caretaker', 'a')], [], sat(10))).toEqual({ kind: 'reply' })
    expect(nextThing([msg('caretaker', 'a'), msg('elder', 'b')], [], sat(10))).toBeNull()
  })
  it('offers "I took my medicine" from 30 min before to an hour after a dose', () => {
    expect(nextThing([], [pill('08:00')], sat(7, 35))).toEqual({ kind: 'meds' })
    expect(nextThing([], [pill('08:00')], sat(8, 55))).toEqual({ kind: 'meds' })
    expect(nextThing([], [pill('08:00')], sat(9, 5))).toBeNull()
    expect(nextThing([], [{ ...pill('08:00'), days: ['mon'] }], sat(8))).toBeNull()   // not today
  })
  it('a reply comes first, and nothing at all is the usual case', () => {
    expect(nextThing([msg('caretaker', 'a')], [pill('08:00')], sat(8))).toEqual({ kind: 'reply' })
    expect(nextThing([], [], sat(15))).toBeNull()
  })
})
