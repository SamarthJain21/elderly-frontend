import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react'

export interface TourStep { target: string; title: string; body: ReactNode; /** Plain text read aloud in `big` (elder) tours. */ say?: string }

/**
 * Coach-mark tour: dims the screen, spotlights one `[data-tour="…"]` section at a time with a pulsing ring,
 * and explains what it's for. `big` = elder style (large text and buttons); `onStep` lets the elder app read it aloud.
 * Steps whose section isn't on screen right now are skipped.
 */
export function Tour({ steps: all, onDone, big = false, onStep }: {
  steps: TourStep[]; onDone: () => void; big?: boolean; onStep?: (s: TourStep) => void
}) {
  // Which sections are on screen — checked after the page has rendered (not during render, when nothing exists yet).
  const [steps, setSteps] = useState<TourStep[] | null>(null)
  useLayoutEffect(() => { setSteps(all.filter(s => document.querySelector(`[data-tour="${s.target}"]`))) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const step = steps?.[i]
  const count = steps?.length ?? 0
  const next = () => (i < count - 1 ? setI(i + 1) : onDone())

  useLayoutEffect(() => {
    if (!step) return
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
    if (!el) { setRect(null); return }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const measure = () => setRect(el.getBoundingClientRect())
    measure()
    const t = window.setTimeout(measure, 380)  // after the smooth scroll settles
    window.addEventListener('resize', measure)
    document.addEventListener('scroll', measure, true)
    return () => { window.clearTimeout(t); window.removeEventListener('resize', measure); document.removeEventListener('scroll', measure, true) }
  }, [step?.target]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (step) onStep?.(step) }, [i, !!steps]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (steps && count === 0) onDone() }, [steps]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') setI(x => Math.max(0, x - 1))
    }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  })
  if (!step) return null

  const pad = 6
  const box = rect && { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
  const cardW = Math.min(big ? 360 : 320, window.innerWidth - 24)
  // Never place the card over the elder's SOS bar: treat its top edge as the bottom of the usable screen.
  const floor = (big && document.querySelector('.sosbar')?.getBoundingClientRect().top) || window.innerHeight
  const below = !rect || rect.bottom + (big ? 260 : 190) < floor
  // Below: pin the card's top under the spotlight. Above: pin its bottom just over it.
  const vertical = !rect ? { top: window.innerHeight / 2 - 90 } : below ? { top: rect.bottom + 16 } : { bottom: window.innerHeight - rect.top + 16 }
  const cardLeft = !rect ? (window.innerWidth - cardW) / 2 : Math.min(Math.max(12, rect.left + rect.width / 2 - cardW / 2), window.innerWidth - cardW - 12)
  const last = i === count - 1

  return (
    <div className={`tour ${big ? 'big' : ''}`} role="dialog" aria-modal="true" aria-label={`Tour step ${i + 1} of ${count}: ${step.title}`}>
      {box ? <><div className="tour-spot" style={box} /><div className="tour-pulse" style={box} key={`p${i}`} /></> : <div className="tour-dim" />}
      <div className="tour-card" style={{ ...vertical, left: cardLeft, width: cardW }} key={i}>
        <div className="row"><span className="eyebrow grow">{big ? `${i + 1} of ${count}` : `Step ${i + 1} of ${count}`}</span>
          <button className="btn ghost sm" onClick={onDone}>{big ? 'Close' : 'Skip tour'}</button></div>
        <h3 className="tour-title">{step.title}</h3>
        <div className="tour-body">{step.body}</div>
        {big ? (
          <div className="row" style={{ marginTop: 14, gap: 10 }}>
            {step.say && onStep && <button className="bb no" style={{ flex: 1, minHeight: 56, fontSize: 18 }} onClick={() => onStep(step)} aria-label="Say it again">🔊 Again</button>}
            <button className="bb yes" style={{ flex: 2, minHeight: 56, fontSize: 19 }} onClick={next}>{last ? 'Got it 👍' : 'Next ›'}</button>
          </div>
        ) : (
          <div className="row" style={{ marginTop: 12 }}>
            <div className="tour-dots" aria-hidden>{steps!.map((_, j) => <i key={j} className={j === i ? 'on' : ''} />)}</div>
            <span className="grow" />
            {i > 0 && <button className="btn sm" onClick={() => setI(i - 1)}>Back</button>}
            <button className="btn sm pri" onClick={next}>{last ? 'Got it' : 'Next'}</button>
          </div>
        )}
      </div>
    </div>
  )
}
