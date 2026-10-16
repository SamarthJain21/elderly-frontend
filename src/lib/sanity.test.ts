import { describe, expect, it } from 'vitest'
import { routineWarnings, type RoutineInput } from './sanity'

const base: RoutineInput = {
  wake: '06:30', bed: '21:30',
  meals: [{ label: 'Breakfast', time: '08:00' }, { label: 'Lunch', time: '12:30' }, { label: 'Dinner', time: '19:00' }],
  checkIns: ['09:00'], meds: [{ name: 'Amlodipine', times: ['08:00', '20:00'], withFood: true }],
}

describe('routine sanity warnings', () => {
  it('a normal day has none', () => expect(routineWarnings(base)).toEqual([]))
  it('flags meals, check-ins and medicines while asleep', () => {
    const w = routineWarnings({ ...base, meals: [...base.meals.slice(0, 2), { label: 'Dinner', time: '22:30' }], checkIns: ['05:00'],
      meds: [{ name: 'Metformin', times: ['23:00'], withFood: false }] })
    expect(w).toContain('Dinner at 22:30 is while they’re usually asleep.')
    expect(w).toContain('The check-in at 05:00 is while they’re usually asleep — they won’t answer.')
    expect(w).toContain('Metformin at 23:00 is while they’re usually asleep.')
  })
  it('handles a bedtime after midnight', () => {
    expect(routineWarnings({ ...base, wake: '08:00', bed: '00:30', meals: [{ label: 'Dinner', time: '23:00' }], checkIns: [], meds: [] })).toEqual([])
  })
  it('meals out of order, too little sleep, food medicines without a meal, duplicates', () => {
    const w = routineWarnings({ ...base, wake: '05:00', bed: '02:00', meals: [{ label: 'Lunch', time: '13:00' }, { label: 'Dinner', time: '12:00' }],
      meds: [{ name: 'Amlodipine', times: ['16:00'], withFood: true }, { name: 'amlodipine ', times: ['09:00'], withFood: false }] })
    expect(w).toContain('Only about 3 hours between bedtime (02:00) and waking (05:00) — is that right?')
    expect(w).toContain('Dinner (12:00) is before lunch (13:00).')
    expect(w).toContain('Amlodipine at 16:00 should be taken with food, but no meal is within 1½ hours.')
    expect(w).toContain('Amlodipine is listed twice.')
  })
  it('skipped items are not checked', () => {
    expect(routineWarnings({ ...base, wake: null, bed: null, checkIns: ['03:00'] })).toEqual([])
  })
})
