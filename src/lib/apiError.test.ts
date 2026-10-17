import { describe, expect, it } from 'vitest'
import { errorText } from './apiError'

describe('errorText (server errors as words, not [object Object])', () => {
  it('names the field that needs fixing', () => {
    const detail = [{ loc: ['body', 'emergencyContacts', 0, 'phone'], msg: 'Value error, include the country code, e.g. +91 98765 43210', type: 'value_error' }]
    expect(errorText(detail)).toBe('Emergency contact 1 · phone number: include the country code, e.g. +91 98765 43210')
  })
  it('passes plain messages through and falls back when there is nothing', () => {
    expect(errorText('Too many tries')).toBe('Too many tries')
    expect(errorText(undefined, 'Not Found')).toBe('Not Found')
    expect(errorText([])).toBe('Something went wrong')
  })
})
