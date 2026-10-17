import type { Medication } from './types'

/** Scanned medicines join the list: blank rows give way, and a name already there isn't added twice. */
export function mergeMeds(current: Medication[], found: Medication[]): Medication[] {
  const kept = current.filter(m => m.name.trim())
  const have = new Set(kept.map(m => m.name.trim().toLowerCase()))
  return [...kept, ...found.filter(m => !have.has(m.name.trim().toLowerCase()))]
}
