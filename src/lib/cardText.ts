import type { Strings } from './i18n'

/**
 * The server writes order/ride cards in English (app/tools/providers.py — the family sees them as they are).
 * On the elder's phone the known shapes are said in their language. Keep these in step with providers.py.
 */
export function cardLine(line: string, t: Strings): string {
  const ride = line.match(/^Ride to (.+) \(~(\d+) km\)$/)
  return ride ? t.rideLine(ride[1], ride[2]) : line
}

export function cardEta(eta: string, t: Strings): string {
  let m: RegExpMatchArray | null
  if ((m = eta.match(/^~(\d+) min drive$/))) return t.etaDrive(m[1])
  if ((m = eta.match(/^about (\d+) min$/))) return t.etaAbout(m[1])
  if ((m = eta.match(/^(\d+(?:–\d+)?) min$/))) return t.etaMins(m[1])
  return eta
}
