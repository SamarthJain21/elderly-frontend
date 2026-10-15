import { describe, expect, it } from 'vitest'
import { add } from 'dinero.js'
import { currencySymbol, formatMinor, fromMinor, minorToInput, parseToMinor, toMinor } from './money'

describe('parseToMinor (2-decimal currencies)', () => {
  it.each([
    ['500', 50_000],
    ['12.5', 1_250],
    ['12.05', 1_205],
    ['0.1', 10],
    ['1,500', 150_000],
    [' 499.99 ', 49_999],
  ])('INR %s -> %i', (input, minor) => expect(parseToMinor(input, 'INR')).toBe(minor))

  it.each(['', 'abc', '-5', '1.234', '1e3', '12.', '.5', '9999999999'])('rejects %j', (input) => {
    expect(parseToMinor(input, 'INR')).toBeNull()
  })

  it('avoids float drift: 0.29 is exactly 29, not 28.999…', () => {
    expect(parseToMinor('0.29', 'THB')).toBe(29)
    expect(parseToMinor('1.15', 'SGD')).toBe(115)
  })
})

describe('zero-decimal currencies (future multi-currency)', () => {
  it('JPY/KRW amounts are whole units — decimals are rejected, not rounded', () => {
    expect(parseToMinor('1500', 'JPY')).toBe(1_500)
    expect(parseToMinor('12.5', 'JPY')).toBeNull()
    expect(parseToMinor('10000', 'KRW')).toBe(10_000)
  })

  it('formats without a decimal part', () => {
    expect(formatMinor(1_500, 'JPY')).toMatch(/1,500/)
    expect(minorToInput(1_500, 'JPY')).toBe('1500')
  })
})

describe('round trips and arithmetic', () => {
  it.each([['INR', [0, 5, 10, 99, 100, 1_205, 50_000, 49_999]], ['JPY', [0, 1, 999, 150_000]]] as const)(
    '%s minorToInput → parseToMinor is lossless', (cur, amounts) => {
      for (const minor of amounts) expect(parseToMinor(minorToInput(minor, cur), cur)).toBe(minor)
    })

  it('adds money exactly and refuses to mix currencies', () => {
    expect(toMinor(add(fromMinor(10, 'INR'), fromMinor(20, 'INR')))).toBe(30)
    expect(() => add(fromMinor(10, 'INR'), fromMinor(20, 'THB') as never)).toThrow()
  })

  it('refuses non-integer minor units from anywhere', () => {
    expect(() => fromMinor(10.5, 'INR')).toThrow(RangeError)
  })
})

describe('display', () => {
  it('uses each currency’s symbol', () => {
    expect(formatMinor(50_000, 'INR')).toContain('₹')
    expect(formatMinor(15_000, 'THB')).toMatch(/฿|THB/)
    expect(currencySymbol('INR')).toBe('₹')
  })

  it('shows paise only when present', () => {
    expect(formatMinor(50_000, 'INR')).not.toContain('.')
    expect(formatMinor(49_950, 'INR')).toContain('.50')
  })
})
