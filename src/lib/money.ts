// Money in the UI, built on dinero.js so each currency's own minor unit is respected
// (INR/THB/SGD have 2 decimals, JPY/KRW have 0). Never parse money to a float.
//
// Wire format with the backend is unchanged: an integer amount in the currency's minor unit
// (paise, satang, cents, yen…) plus an ISO 4217 code. Dinero objects live only inside the UI.
import { dinero, toDecimal, toSnapshot, transformScale, type Dinero } from 'dinero.js'
import { INR, JPY, KRW, SGD, THB } from 'dinero.js/currencies'

const CURRENCIES = { INR, THB, SGD, JPY, KRW } as const
export type Currency = keyof typeof CURRENCIES

const LOCALE: Record<Currency, string> = { INR: 'en-IN', THB: 'th-TH', SGD: 'en-SG', JPY: 'ja-JP', KRW: 'ko-KR' }

/** Display symbol for input adornments, from the platform's own currency data. */
export function currencySymbol(currency: Currency): string {
  return new Intl.NumberFormat(LOCALE[currency], { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
    .formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency
}

export function exponentOf(currency: Currency): number {
  return CURRENCIES[currency].exponent
}

/** Integer minor units from the API → Dinero. */
export function fromMinor(minor: number, currency: Currency): Dinero<number> {
  if (!Number.isSafeInteger(minor)) throw new RangeError(`money must be an integer, got ${minor}`)
  return dinero({ amount: minor, currency: CURRENCIES[currency] })
}

/** Dinero → integer minor units for the API (at the currency's own scale). */
export function toMinor(d: Dinero<number>): number {
  const snap = toSnapshot(d)
  return snap.scale === snap.currency.exponent ? snap.amount : toSnapshot(transformScale(d, snap.currency.exponent)).amount
}

/** For display only. Exact: formats the decimal *string*, never a float division. */
export function formatMoney(d: Dinero<number>): string {
  const { currency } = toSnapshot(d)
  const code = currency.code as Currency
  const decimal = toDecimal(d)
  const whole = !decimal.includes('.') || /\.0+$/.test(decimal)
  return new Intl.NumberFormat(LOCALE[code], {
    style: 'currency', currency: code, minimumFractionDigits: whole ? 0 : currency.exponent,
  }).format(decimal as unknown as number) // Intl accepts numeric strings exactly (ES2023)
}

export function formatMinor(minor: number, currency: Currency): string {
  return formatMoney(fromMinor(minor, currency))
}

/**
 * What a person typed → Dinero, or null if it isn't a valid amount *for this currency*:
 * "499.50" is fine in INR, but "12.5" is rejected for JPY (no minor unit).
 */
export function parseMoney(input: string, currency: Currency): Dinero<number> | null {
  const exp = exponentOf(currency)
  const pattern = exp === 0 ? /^(\d{1,9})$/ : new RegExp(`^(\\d{1,9})(?:\\.(\\d{1,${exp}}))?$`)
  const m = pattern.exec(input.trim().replace(/,/g, ''))
  if (m === null) return null
  const whole = Number(m[1])
  const frac = exp === 0 ? 0 : Number((m[2] ?? '').padEnd(exp, '0'))
  const minor = whole * 10 ** exp + frac
  return Number.isSafeInteger(minor) ? fromMinor(minor, currency) : null
}

export function parseToMinor(input: string, currency: Currency): number | null {
  const d = parseMoney(input, currency)
  return d === null ? null : toMinor(d)
}

/** Integer minor units → editable text: 50000 INR → "500", 1250 INR → "12.50", 1500 JPY → "1500". */
export function minorToInput(minor: number, currency: Currency): string {
  const decimal = toDecimal(fromMinor(minor, currency))
  return /\.0+$/.test(decimal) ? decimal.replace(/\.0+$/, '') : decimal
}
