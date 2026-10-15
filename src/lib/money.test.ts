import { describe, expect, it } from 'vitest'
import { formatMoney, minorToInput, parseToMinor } from './money'

describe('parseToMinor', () => {
  it.each<[string, number]>([['500', 50_000], ['12.5', 1_250], ['12.05', 1_205], ['0.1', 10], ['1,500', 150_000], [' 499.99 ', 49_999]])(
    '%s -> %i', (input, minor) => expect(parseToMinor(input, 'INR')).toBe(minor))

  it.each<string>(['', 'abc', '-5', '1.234', '1e3', '12.', '.5', '9999999999'])('rejects %j', (input) => {
    expect(parseToMinor(input, 'INR')).toBeNull()
  })

  it('has no float drift', () => {
    expect(parseToMinor('0.29', 'THB')).toBe(29)
    expect(parseToMinor('1.15', 'SGD')).toBe(115)
  })
})

describe('formatMoney', () => {
  it('shows minor units only when present', () => {
    expect(formatMoney(50_000, 'INR')).toBe('₹500')
    expect(formatMoney(123_456_789, 'INR')).toBe('₹1,234,567.89')
    expect(formatMoney(4_850, 'THB')).toBe('฿48.50')
  })

  it('formats negative amounts correctly (was ₹-2.-50)', () => {
    expect(formatMoney(-150, 'INR')).toBe('−₹1.50')
  })

  it('refuses non-integer minor units', () => {
    expect(() => formatMoney(10.5, 'INR')).toThrow(RangeError)
  })
})

it('minorToInput round-trips through parseToMinor', () => {
  for (const m of [0, 5, 99, 100, 1_205, 50_000, 49_999]) expect(parseToMinor(minorToInput(m, 'INR'), 'INR')).toBe(m)
})
