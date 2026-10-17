import { describe, expect, it } from 'vitest'
import { cardEta, cardLine } from './cardText'
import { strings } from './i18n'

describe('order/ride card text in the elder’s language (shapes from app/tools/providers.py)', () => {
  const hi = strings('hi-IN')
  it('says the ride line and travel time in Hindi', () => {
    expect(cardLine('Ride to मंदिर (~2 km)', hi)).toBe('मंदिर तक की सवारी (~2 कि.मी.)')
    expect(cardEta('~5 min drive', hi)).toBe('~5 मिनट का रास्ता')
    expect(cardEta('30–40 min', hi)).toBe('30–40 मिनट')
    expect(cardEta('about 20 min', hi)).toBe('लगभग 20 मिनट')
  })
  it('leaves anything else as it is', () => {
    expect(cardLine('2 × roti', hi)).toBe('2 × roti')
    expect(cardEta('tomorrow', hi)).toBe('tomorrow')
    expect(cardLine('Ride to Clinic (~4 km)', strings('en-US'))).toBe('Ride to Clinic (~4 km)')
  })
})
