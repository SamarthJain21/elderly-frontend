import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { api } from '../data/live'
import { uid } from '../data/store'
import type { Medication } from '../lib/types'
import { mergeMeds } from '../lib/meds'
import type { ScannedMedicine } from '../data/api'

type Meals = { breakfast: string | null; lunch: string | null; dinner: string | null }

/**
 * The medicines list the family edits — in setup and later in Routine. With `live`, a prescription photo can fill
 * the list (Gemini reads it; the family reviews every line).
 */
export function MedEditor({ meds, setMeds, meals, live }: {
  meds: Medication[]; setMeds: Dispatch<SetStateAction<Medication[]>>; meals: Meals; live: boolean
}) {
  const edit = (i: number, patch: Partial<Medication>) => setMeds(ms => ms.map((x, j) => j === i ? { ...x, ...patch } : x))
  return (
    <>
      {live && <RxScan meals={meals} existing={meds.filter(m => m.name.trim()).map(m => `${m.name.trim()} ${m.dose.trim()}`.trim())} onAdd={found => setMeds(ms => mergeMeds(ms, found))} />}
      {meds.map((m, i) => (
        <div key={m.id} className="card stack medcard" style={{ gap: 8 }}>
          <div className="row"><div className="grow"><label className="field">💊 Medicine<input value={m.name} maxLength={100} onChange={e => edit(i, { name: e.target.value })} /></label>
            </div>
            <label className="field" style={{ width: 100 }}>Dose<input value={m.dose} maxLength={60} onChange={e => edit(i, { dose: e.target.value })} /></label></div>
          <div className="field">Times each day
            <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
              {m.times.map((t, ti) => (
                <span key={ti} className="row" style={{ gap: 2 }}>
                  <input type="time" style={{ width: 120 }} value={t} aria-label={`Time ${ti + 1}`}
                    onChange={e => edit(i, { times: m.times.map((y, yi) => yi === ti ? e.target.value : y) })} />
                  {m.times.length > 1 && <button className="btn sm ghost" aria-label="Remove time" onClick={() => edit(i, { times: m.times.filter((_, yi) => yi !== ti) })}>✕</button>}
                </span>
              ))}
              {m.times.length < 8 && <button className="btn sm" onClick={() => edit(i, { times: [...m.times, '20:00'] })}>＋ time</button>}
            </div>
          </div>
          {m.notes && <p className="small muted">📝 {m.notes}</p>}
          <div className="row"><label className="row small grow" style={{ fontWeight: 700 }}><input type="checkbox" checked={m.withFood} onChange={e => edit(i, { withFood: e.target.checked })} /> Take with food</label>
            <button className="btn sm ghost" onClick={() => setMeds(ms => ms.filter((_, j) => j !== i))}>Remove medicine</button></div>
        </div>
      ))}
      <button className="btn" onClick={() => setMeds(ms => [...ms, { id: uid('m'), name: '', dose: '', times: ['20:00'], withFood: true, notes: '' }])}>＋ Add a medicine</button>
    </>
  )
}

/** Photos are shrunk before upload: a phone photo is 3–12 MB, ~1600 px is plenty to read a prescription. */
async function shrink(file: File): Promise<{ data: string; type: string }> {
  try {
    const bmp = await createImageBitmap(file)
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    return { data: c.toDataURL('image/jpeg', 0.85).split(',')[1], type: 'image/jpeg' }
  } catch {  // a format the browser can't draw (HEIC on Chrome) — send it as it is
    const buf = new Uint8Array(await file.arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
    return { data: btoa(bin), type: file.type || 'image/jpeg' }
  }
}

type Draft = ScannedMedicine & { pick: boolean }

/** 📷 Prescription or medicine strip → a checklist the family confirms. Nothing is added without their tick. */
function RxScan({ meals, existing, onAdd }: { meals: Meals; existing: string[]; onAdd: (m: Medication[]) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<'idle' | 'reading' | 'review' | 'failed'>('idle')
  const [msg, setMsg] = useState('')
  const [drafts, setDrafts] = useState<Draft[]>([])

  const read = async (file: File) => {
    setState('reading')
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('That photo is too large — try another')
      const { data, type } = await shrink(file)
      const r = await api.scanPrescription(data, type, meals, existing)
      if (r.unreadable) { setMsg('Couldn’t find medicines in that photo. Try a flat, well-lit photo of the prescription or the strip.'); setState('failed'); return }
      setDrafts(r.medicines.map(m => ({ ...m, pick: !m.asNeeded && !m.sameAs })))
      setState('review')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Couldn’t read the photo — try again or type it in'); setState('failed')
    }
  }
  const picked = drafts.filter(d => d.pick)

  return (
    <div className="card rx">
      <input ref={input} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void read(f) }} />
      {state === 'idle' && <>
        <button className="btn pri block" onClick={() => input.current?.click()}>📷 Scan a prescription or strip</button>
        <p className="small muted center" style={{ marginTop: 6 }}>Gemini reads it and you check every line. Or type them below.</p>
      </>}
      {state === 'reading' && <p className="rx-reading"><span className="spin" aria-hidden /> Reading the prescription… <span className="small muted">about 10 seconds</span></p>}
      {state === 'failed' && <>
        <p className="small" role="alert">⚠️ {msg}</p>
        <button className="btn sm" style={{ marginTop: 8 }} onClick={() => input.current?.click()}>Try another photo</button>
      </>}
      {state === 'review' && <>
        <p className="eyebrow">Found {drafts.length} — tick the ones to add</p>
        {drafts.map((d, i) => (
          <label key={i} className={`rx-row${d.unsure ? ' unsure' : ''}`}>
            <input type="checkbox" checked={d.pick} onChange={e => setDrafts(ds => ds.map((x, j) => j === i ? { ...x, pick: e.target.checked } : x))} />
            <span className="grow"><b>{d.name}</b>{d.dose ? ` · ${d.dose}` : ''}
              <span className="small muted" style={{ display: 'block' }}>
                {d.asNeeded ? 'Only when needed — no daily reminder unless you tick it' : `${d.times.join(', ')}${d.withFood ? ' · with food' : ''}`}
                {d.notes && !d.asNeeded ? ` · ${d.notes}` : ''}
              </span>
              {d.sameAs && <span className="small" style={{ display: 'block', color: 'var(--sos)', fontWeight: 700 }}>⚠️ Same medicine as {d.sameAs}, already on the list — taking both could double the dose. Ask the doctor before adding.</span>}
              {d.unsure && <span className="small" style={{ display: 'block', color: 'var(--amber)' }}>⚠️ Hard to read — please check this one</span>}
            </span>
          </label>
        ))}
        <p className="small muted" style={{ margin: '8px 0' }}>Check each line against the prescription. You can change times below after adding.</p>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn pri grow" disabled={!picked.length} onClick={() => {
            onAdd(picked.map(d => ({ id: uid('m'), name: d.name, dose: d.dose, times: d.times, withFood: d.withFood, notes: d.notes })))
            setState('idle'); setDrafts([])
          }}>Add {picked.length} {picked.length === 1 ? 'medicine' : 'medicines'}</button>
          <button className="btn" onClick={() => { setState('idle'); setDrafts([]) }}>Cancel</button>
        </div>
      </>}
    </div>
  )
}
