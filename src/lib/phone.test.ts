import { describe, expect, it } from 'vitest'
import { countryForTimezone, formatPhone, parsePhone, phoneError } from './phone'

describe('phone numbers', () => {
  it('formats national digits with the country code, grouped for reading', () => {
    expect(formatPhone('IN', '9876543210')).toBe('+91 98765 43210')
    expect(formatPhone('TH', '0812345678')).toBe('+66 81 234 5678')   // local leading 0 dropped
    expect(formatPhone('SG', '91234567')).toBe('+65 9123 4567')
  })
  it('reads stored numbers back into country + digits, longest code first', () => {
    expect(parsePhone('+91 98765 43210')).toEqual({ country: 'IN', national: '9876543210' })
    expect(parsePhone('+971 50 123 4567')).toEqual({ country: 'AE', national: '501234567' })
    expect(parsePhone('98765 43210', 'IN')).toEqual({ country: 'IN', national: '9876543210' })
  })
  it('explains what is wrong', () => {
    expect(phoneError('+91 98765 43210')).toBeNull()
    expect(phoneError('+91 98765')).toBe('India numbers have 10 digits after +91')
    expect(phoneError('')).toBe('Enter a phone number')
  })
  it('defaults the country from where the elder lives', () => {
    expect([countryForTimezone('Asia/Bangkok'), countryForTimezone('Asia/Kolkata'), countryForTimezone(undefined)]).toEqual(['TH', 'IN', 'IN'])
  })
})

describe('phone digit limit', () => {
  it('formatPhone keeps what it is given; the field caps typing at the country’s length', () => {
    // PhoneField slices to Math.max(...digits) before formatting: India 10, Thailand 9
    expect(formatPhone('IN', '98765432109999'.slice(0, 10))).toBe('+91 98765 43210')
    expect(formatPhone('TH', '0812345678999'.replace(/^0+/, '').slice(0, 9))).toBe('+66 81 234 5678')
  })
})
