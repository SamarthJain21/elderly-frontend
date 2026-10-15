import type { Currency } from './types'

// Same ISO 4217 exponents and symbols as app/autonomy.py. Money is always integer minor units.
const EXPONENT: Record<Currency, number> = { INR: 2, THB: 2, SGD: 2 }
const SYMBOL: Record<Currency, string> = { INR: '₹', THB: '฿', SGD: 'S$' }

export function formatMoney(minor: number, currency: Currency): string {
  const exp = EXPONENT[currency]
  const whole = Math.floor(minor / 10 ** exp)
  const frac = minor % 10 ** exp
  return `${SYMBOL[currency]}${whole.toLocaleString('en-US')}${frac ? '.' + String(frac).padStart(exp, '0') : ''}`
}

export const toMinor = (major: number, currency: Currency) => Math.round(major * 10 ** EXPONENT[currency])
export const toMajor = (minor: number, currency: Currency) => minor / 10 ** EXPONENT[currency]

// app/autonomy.py → currency_for_timezone
export const currencyForTimezone = (tz: string | null | undefined): Currency =>
  tz === 'Asia/Bangkok' ? 'THB' : tz === 'Asia/Singapore' ? 'SGD' : 'INR'

export const TIMEZONES: { tz: string; label: string }[] = [
  { tz: 'Asia/Kolkata', label: 'India (IST)' },
  { tz: 'Asia/Bangkok', label: 'Thailand (ICT)' },
  { tz: 'Asia/Singapore', label: 'Singapore (SGT)' },
]

/** Demo FX for showing "≈ local" next to a USD price. Real checkout uses the processor's live rate. */
const USD_RATE: Record<Currency, number> = { INR: 83, THB: 36, SGD: 1.35 }
export const usdToLocalMinor = (cents: number, currency: Currency) => Math.round(cents * USD_RATE[currency])

// Local payment methods per market, shown at checkout.
export const LOCAL_WALLET: Record<Currency, { id: string; label: string; hint: string }> = {
  INR: { id: 'upi', label: 'UPI', hint: 'Pay with any UPI app' },
  THB: { id: 'promptpay', label: 'PromptPay', hint: 'Scan with your banking app' },
  SGD: { id: 'paynow', label: 'PayNow', hint: 'Scan with your banking app' },
}
