/** Phone numbers in international form ("+91 98765 43210"): what tel: links and SMS need. */
export interface Country { code: string; flag: string; name: string; dial: string; digits: number[]; groups: number[]; example: string }

// digits: allowed national-number lengths (no leading 0). groups: how to space it for reading.
export const COUNTRIES: Country[] = [
  { code: 'IN', flag: '🇮🇳', name: 'India', dial: '+91', digits: [10], groups: [5, 5], example: '98765 43210' },
  { code: 'TH', flag: '🇹🇭', name: 'Thailand', dial: '+66', digits: [9], groups: [2, 3, 4], example: '81 234 5678' },
  { code: 'SG', flag: '🇸🇬', name: 'Singapore', dial: '+65', digits: [8], groups: [4, 4], example: '9123 4567' },
  { code: 'MY', flag: '🇲🇾', name: 'Malaysia', dial: '+60', digits: [9, 10], groups: [2, 4, 4], example: '12 345 6789' },
  { code: 'AE', flag: '🇦🇪', name: 'UAE', dial: '+971', digits: [9], groups: [2, 3, 4], example: '50 123 4567' },
  { code: 'GB', flag: '🇬🇧', name: 'UK', dial: '+44', digits: [10], groups: [4, 6], example: '7911 123456' },
  { code: 'US', flag: '🇺🇸', name: 'US / Canada', dial: '+1', digits: [10], groups: [3, 3, 4], example: '415 555 0132' },
  { code: 'AU', flag: '🇦🇺', name: 'Australia', dial: '+61', digits: [9], groups: [3, 3, 3], example: '412 345 678' },
]
const BY_DIAL = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length)  // longest prefix first (+971 before +9…)

export const countryForTimezone = (tz?: string | null): string =>
  ({ 'Asia/Kolkata': 'IN', 'Asia/Bangkok': 'TH', 'Asia/Singapore': 'SG', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Dubai': 'AE' } as Record<string, string>)[tz ?? ''] ?? 'IN'

/** Split a stored number into country + national digits. Unknown prefixes keep their digits with the fallback country. */
export function parsePhone(value: string, fallback = 'IN'): { country: string; national: string } {
  const v = value.replace(/[^\d+]/g, '')
  if (v.startsWith('+')) {
    const c = BY_DIAL.find(x => v.startsWith(x.dial))
    if (c) return { country: c.code, national: v.slice(c.dial.length) }
  }
  return { country: fallback, national: v.replace(/^\+/, '').replace(/^0+/, '') }  // local "098…" → "98…"
}

export function formatPhone(country: string, national: string): string {
  const c = COUNTRIES.find(x => x.code === country) ?? COUNTRIES[0]
  const d = national.replace(/\D/g, '').replace(/^0+/, '')
  if (!d) return ''
  const parts: string[] = []
  let i = 0
  for (const g of c.groups) { if (i >= d.length) break; parts.push(d.slice(i, i + g)); i += g }
  if (i < d.length) parts.push(d.slice(i))
  return `${c.dial} ${parts.join(' ')}`
}

/** null = fine; otherwise a short message for under the field. */
export function phoneError(value: string): string | null {
  if (!value.trim()) return 'Enter a phone number'
  const { country, national } = parsePhone(value)
  const c = COUNTRIES.find(x => x.code === country)!
  if (!c.digits.includes(national.length)) return `${c.name} numbers have ${c.digits.join(' or ')} digits after ${c.dial}`
  return null
}

