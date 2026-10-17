const FIELD: Record<string, string> = {
  emergencyContacts: 'Emergency contact', medications: 'Medicine', phone: 'phone number', name: 'name',
  address: 'address', line1: 'address', city: 'city', postcode: 'postcode', times: 'time', dose: 'dose',
}

/**
 * The server's error as one sentence. FastAPI's validation errors come as a list of objects
 * ({loc: ['body', 'emergencyContacts', 0, 'phone'], msg: 'Value error, include the country code…'}), which used to
 * show as "[object Object]".
 */
export function errorText(detail: unknown, fallback = 'Something went wrong'): string {
  if (typeof detail === 'string') return detail || fallback
  if (!Array.isArray(detail) || !detail.length) return fallback
  return detail.slice(0, 2).map(d => {
    const e = d as { loc?: (string | number)[]; msg?: string }
    const msg = (e.msg ?? '').replace(/^Value error, /, '')
    const parts: string[] = []
    for (const p of (e.loc ?? []).filter(p => p !== 'body')) {
      if (typeof p === 'number') { if (parts.length) parts[parts.length - 1] += ` ${p + 1}`; continue }
      parts.push(FIELD[p] ?? p)
    }
    return parts.length ? `${parts.join(' · ')}: ${msg}` : msg
  }).join('; ')
}
