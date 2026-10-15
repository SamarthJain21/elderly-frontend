import { describe, expect, it } from 'vitest'
import { demoInsights } from './insights'
import type { CheckInRecord, Mood } from './types'

const TODAY = new Date('2026-10-20T12:00:00Z')
const day = (n: number) => new Date(TODAY.getTime() - n * 86_400_000).toISOString().slice(0, 10)
const ci = (n: number, mood: Mood = 'good', meds: boolean | null = true): CheckInRecord => ({
  id: `e_${day(n)}`, elderId: 'e', date: day(n), status: 'done', mood, sleepQuality: 'well', sleepHours: 7,
  meals: 'rice', medicationTaken: meds, anomalies: [], urgent: [], escalateFlag: false,
})

describe('demoInsights mirrors the backend rules', () => {
  it('steady week → stable', () => {
    expect(demoInsights(Array.from({ length: 14 }, (_, i) => ci(i)), TODAY).status).toBe('stable')
  })
  it('two low days after a good baseline → mood drift', () => {
    const data = [...Array.from({ length: 12 }, (_, i) => ci(i + 2)), ci(1, 'low'), ci(0, 'low')]
    const ins = demoInsights(data, TODAY)
    expect(ins.status).toBe('watch')
    expect(ins.drifts.map(d => [d.signal, d.days])).toEqual([['mood', 2]])
  })
  it('one bad day is not drift', () => {
    const data = [...Array.from({ length: 13 }, (_, i) => ci(i + 1)), ci(0, 'bad')]
    expect(demoInsights(data, TODAY).drifts).toEqual([])
  })
})
