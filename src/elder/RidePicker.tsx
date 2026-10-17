import { useEffect, useState } from 'react'
import { api } from '../data/live'
import type { SavedPlace } from '../data/api'
import type { DemoState } from '../data/store'
import { strings } from '../lib/i18n'

/**
 * "Where to?" for the 🚕 tile: the places the family saved (Clinic, Temple, Priya's home…) as big buttons, or
 * "somewhere else" — then the helper asks. No saved places: straight to the helper, who asks where.
 */
export function RidePicker({ s, onPick, onClose }: { s: DemoState; onPick: (said: string) => void; onClose: () => void }) {
  const t = strings(s.elder.language)
  const [places, setPlaces] = useState<SavedPlace[] | null>(null)
  useEffect(() => {
    api.savedPlaces(s.live.elderId!).then(list => {
      if (list.length) setPlaces(list)
      else onPick(t.sayRide)
    }, () => onPick(t.sayRide))
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  if (!places) return null
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet stack" role="dialog" aria-modal="true" aria-label={t.rideWhere} style={{ gap: 12 }} onClick={e => e.stopPropagation()}>
        <div className="grab" />
        <h2 style={{ fontSize: 28 }}>🚕 {t.rideWhere}</h2>
        {places.map(p => <button key={p.id} className="bb no" onClick={() => onPick(t.rideTo(p.name))}>📍 {p.name}</button>)}
        <button className="bb no" onClick={() => onPick(t.sayRide)}>{t.rideElse}</button>
        <button className="bb white" onClick={onClose}>{t.home}</button>
      </div>
    </div>
  )
}
