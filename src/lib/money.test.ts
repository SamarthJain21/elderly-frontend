import { describe, expect, it } from 'vitest'
import { formatMinor, minorToInput, parseToMinor } from './money'

describe('parseToMinor', () => {
  it.each([
    ['500', 50_000],
    ['12.5', 1_250],
    ['12.05', 1_205],
    ['0.1', 10],
    ['1,500', 150_000],
    [' 499.99 ', 49_999],
  ])('%s -> %i', (input, minor) => expect(parseToMinor(input)).toBe(minor))

  it.each(['', 'abc', '-5', '1.234', '1e3', '12.', '.5', '99999999'])('rejects %j', (input) => {
    expect(parseToMinor(input)).toBeNull()
  })

  it('avoids float drift: 0.29 is exactly 29, not 28.999…', () => {
    expect(parseToMinor('0.29')).toBe(29)
    expect(parseToMinor('1.15')).toBe(115)
  })
})

describe('minorToInput', () => {
  it('round-trips through parseToMinor', () => {
    for (const minor of [0, 5, 10, 99, 100, 1_205, 50_000, 49_999]) {
      expect(parseToMinor(minorToInput(minor))).toBe(minor)
    }
  })
})

describe('formatMinor', () => {
  it('shows the right currency symbol', () => {
    expect(formatMinor(50_000, 'INR')).toContain('₹')
    expect(formatMinor(15_000, 'THB')).toMatch(/฿|THB/)
  })
})
