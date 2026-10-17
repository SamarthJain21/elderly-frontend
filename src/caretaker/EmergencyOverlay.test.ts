import { describe, expect, it } from 'vitest'
import { whatHappened } from './EmergencyOverlay'

describe('whatHappened (the SOS screen says it once, plainly)', () => {
  it('drops the repeated name, the double stop and who was texted', () => {
    expect(whatHappened('🚨 SOS — Rose may need urgent help: Rose fell in the bathroom and cannot get up.. Emma and Tom are not texted in this demo.', 'Rose'))
      .toBe('Rose fell in the bathroom and cannot get up.')
    expect(whatHappened('🚨 SOS — Kamla pressed the SOS button. Texted Priya.', 'Kamla')).toBe('Pressed the SOS button.')
  })
})
