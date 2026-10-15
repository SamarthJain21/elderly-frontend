import { dinero, toDecimal, type Dinero } from 'dinero.js'
import { INR, SGD, THB } from 'dinero.js/currencies'
import type { Currency } from './types'

// Money is integer minor units (paise / satang / cents) end to end; dinero.js wraps it in the UI so each currency
// keeps its own minor unit and amounts are never parsed through floating point. Mirrors app/autonomy.py.

const CURRENCIES = { INR, THB, SGD } as const
const SYMBOL: Record<Currency, string> = { INR: '₹', THB: '฿', SGD: 'S$' }

export const exponentOf = (currency: Currency): number => CURRENCIES[currency].exponent

export function fromMinor(minor: number, currency: Currency): Dinero<number> {
  if (!Number.isSafeInteger(minor)) throw new RangeError(`money must be an integer, got ${minor}`)
  return dinero({ amount: minor, currency: CURRENCIES[currency] })
}

/** "₹1,234.50", "−₹150" — exact (formats dinero's decimal string, never a float division). */
export function formatMoney(minor: number, currency: Currency): string {
  const dec = toDecimal(fromMinor(Math.abs(minor), currency))
  const [whole, frac = ''] = dec.split('.')
  const grouped = Number(whole).toLocaleString('en-US')  // whole part only: an integer, exact
  const shown = /^0*$/.test(frac) ? grouped : `${grouped}.${frac}`
  return `${minor < 0 ? '−' : ''}${SYMBOL[currency]}${shown}`
}

/** What a person typed → integer minor units, or null if it isn't a valid amount for this currency. */
export function parseToMinor(input: string, currency: Currency): number | null {
  const exp = exponentOf(currency)
  const re = exp === 0 ? /^(\d{1,9})$/ : new RegExp(`^(\\d{1,9})(?:\\.(\\d{1,${exp}}))?$`)
  const m = re.exec(input.trim().replace(/,/g, ''))
  if (m === null) return null
  const minor = Number(m[1]) * 10 ** exp + (exp === 0 ? 0 : Number((m[2] ?? '').padEnd(exp, '0')))
  return Number.isSafeInteger(minor) ? minor : null
}

/** Integer minor units → editable text: 50000 INR → "500", 1250 → "12.50". */
export function minorToInput(minor: number, currency: Currency): string {
  const dec = toDecimal(fromMinor(minor, currency))
  return /\.0+$/.test(dec) ? dec.replace(/\.0+$/, '') : dec
}

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
