import { useState } from 'react'
import { COUNTRIES, formatPhone, parsePhone, phoneError } from '../lib/phone'

/** Country code + number. Emits "+91 98765 43210". Shows what's wrong once the field has been left. */
export function PhoneField({ label, value, onChange, defaultCountry = 'IN', optional = false }: {
  label: string; value: string; onChange: (v: string) => void; defaultCountry?: string; optional?: boolean
}) {
  const parsed = parsePhone(value, defaultCountry)
  const [country, setCountry] = useState(parsed.country)
  const [touched, setTouched] = useState(false)
  const c = COUNTRIES.find(x => x.code === country) ?? COUNTRIES[0]
  const national = parsePhone(value, country).national
  const err = touched && !(optional && !value) ? phoneError(value) : null
  return (
    <label className="field phone-field">{label}
      <span className={`phone-row ${err ? 'invalid' : ''}`}>
        <select aria-label="Country code" value={country} onChange={e => { setCountry(e.target.value); onChange(formatPhone(e.target.value, national)) }}>
          {COUNTRIES.map(x => <option key={x.code} value={x.code}>{x.flag} {x.dial}</option>)}
        </select>
        <input inputMode="tel" autoComplete="tel-national" value={national} placeholder={c.example} aria-invalid={!!err}
          onChange={e => onChange(formatPhone(country, e.target.value))} onBlur={() => setTouched(true)} />
      </span>
      {err && <span className="field-err" role="alert">{err}</span>}
    </label>
  )
}
