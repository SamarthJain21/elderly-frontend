import { describe, expect, it } from 'vitest'
import { mergeMeds } from './meds'
import type { Medication } from './types'

const med = (name: string, id = name): Medication => ({ id, name, dose: '', times: ['08:00'], withFood: false, notes: '' })

describe('mergeMeds (scanned prescription joins the list)', () => {
  it('replaces blank rows and keeps what was typed', () => {
    expect(mergeMeds([med(''), med('Telma 40')], [med('Pan 40')]).map(m => m.name)).toEqual(['Telma 40', 'Pan 40'])
  })
  it('does not add a medicine already on the list, whatever the case or spacing', () => {
    expect(mergeMeds([med('Telma 40')], [med(' telma 40 ', 'x'), med('Dolo 650')]).map(m => m.id)).toEqual(['Telma 40', 'Dolo 650'])
  })
})
