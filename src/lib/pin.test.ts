import { describe, expect, it } from 'vitest'
import { pinProblem } from './pin'

describe('pinProblem (matches the server rule)', () => {
  it('accepts 4–6 digit PINs that are not obvious', () => {
    expect(pinProblem('4826')).toBeNull()
    expect(pinProblem('739105')).toBeNull()
  })
  it('refuses the wrong length or non-digits', () => {
    for (const p of ['123', '1234567', '12a4', '']) expect(pinProblem(p)).toBe('format')
  })
  it('refuses repeated digits and straight runs', () => {
    for (const p of ['1111', '1234', '9876', '456789']) expect(pinProblem(p)).toBe('weak')
  })
})
