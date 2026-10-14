// Money is integer minor units (paise / satang / cents) end to end. Never parse to float.
export type Currency = 'INR' | 'THB' | 'SGD'

const LOCALE: Record<Currency, string> = { INR: 'en-IN', THB: 'th-TH', SGD: 'en-SG' }
export const CURRENCY_SYMBOL: Record<Currency, string> = { INR: '₹', THB: '฿', SGD: 'S$' }

/** For display only. All supported currencies have 2 minor digits. */
export function formatMinor(minor: number, currency: Currency): string {
  return new Intl.NumberFormat(LOCALE[currency], {
    style: 'currency', currency, minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100)
}

/** "500" -> 50000, "12.5" -> 1250, "12.05" -> 1205. Returns null if not a valid amount. */
export function parseToMinor(input: string): number | null {
  const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(input.trim().replace(/,/g, ''))
  if (m === null) return null
  const whole = Number(m[1])
  const frac = Number((m[2] ?? '').padEnd(2, '0'))
  return whole * 100 + frac
}

/** 50000 -> "500", 1250 -> "12.50" — for editable inputs. */
export function minorToInput(minor: number): string {
  const whole = Math.trunc(minor / 100)
  const frac = minor % 100
  return frac === 0 ? String(whole) : `${whole}.${String(frac).padStart(2, '0')}`
}
