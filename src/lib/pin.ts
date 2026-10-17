/** Same rules as the server (app/elder_pin.py): 4–6 digits, not 1111 or 1234-style. */
export function pinProblem(pin: string): 'format' | 'weak' | null {
  if (!/^\d{4,6}$/.test(pin)) return 'format'
  if (new Set(pin).size === 1 || '0123456789'.includes(pin) || '9876543210'.includes(pin)) return 'weak'
  return null
}
