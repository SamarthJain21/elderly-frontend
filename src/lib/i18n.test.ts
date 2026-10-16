import { describe, expect, it } from 'vitest'
import { partOfDay, strings, type Strings } from './i18n'

const THAI = /[฀-๿]/
const DEVANAGARI = /[ऀ-ॿ]/

/** Every plain-text value in a dictionary (functions are called with a sample name). */
function texts(t: Strings): string[] {
  const out: string[] = []
  const walk = (v: unknown): void => {
    if (typeof v === 'string') out.push(v)
    else if (typeof v === 'function') walk((v as (...a: unknown[]) => unknown)('Nok', 'Nok'))
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk({ ...t, locale: undefined })
  return out
}

describe('elder app translations', () => {
  it.each([['th-TH', THAI], ['hi-IN', DEVANAGARI]] as const)('%s: every label is actually translated', (lang, script) => {
    // Short codes like "Elderly" may stay; anything with 3+ letters and none of the script is a missed string.
    const missed = texts(strings(lang)).filter(s => !script.test(s) && /[A-Za-z]{3,}/.test(s.replace(/Elderly|Chrome|Edge|Nok|SOS/g, '')))
    expect(missed).toEqual([])
  })

  it('hi-Latn: Hinglish is Roman-script Hindi — no Devanagari, and not just English', () => {
    const all = texts(strings('hi-Latn'))
    expect(all.filter(s => DEVANAGARI.test(s))).toEqual([])
    const en = texts(strings('en-US'))
    const same = all.filter((s, i) => s === en[i] && /[a-z]{4,}/i.test(s))
    expect(same.length).toBeLessThan(all.length * 0.1)  // a few loanwords ("Helper", "Taxi") are fine
  })

  it('the tour has the same six steps in every language', () => {
    for (const lang of ['en-US', 'hi-IN', 'hi-Latn', 'th-TH'] as const) expect(strings(lang).tour('Nok')).toHaveLength(6)
  })

  it('languages without a translation fall back to English', () => {
    expect(strings('ja-JP').tileFood).toBe('Food')
  })

  it('greets by time of day', () => {
    expect([partOfDay(8), partOfDay(14), partOfDay(19)]).toEqual(['morning', 'afternoon', 'evening'])
  })
})

describe('Thai with a Latin-script name', () => {
  const t = strings('th-TH')
  it('sets the name off with spaces, without stray spaces before punctuation', () => {
    expect(t.tileOk('Nok')).toBe('บอก Nok ว่าสบายดี')
    expect(t.ob.hi('Somsri')).toBe('สวัสดีค่ะคุณ Somsri!')
    expect(t.tour('Nok')[0].body).toContain('“โทรหา Nok”')
  })
  it('keeps a Thai-script name joined, as Thai is written', () => {
    expect(t.tileOk('นก')).toBe('บอกนกว่าสบายดี')
  })
})
