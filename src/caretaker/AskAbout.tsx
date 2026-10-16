import { useState } from 'react'
import { api } from '../data/live'
import { nick, type DemoState } from '../data/store'

type QA = { q: string; a: string | null; err?: string }

/**
 * "Ask about Mum" (app/routers/ask_api.py): a question in your own words, answered by Gemini from the last two
 * weeks of check-ins and the helper's activity — with the days it saw, or "ask them" when the records don't say.
 */
export function AskAbout({ s }: { s: DemoState }) {
  const nk = nick(s)
  const [q, setQ] = useState('')
  const [log, setLog] = useState<QA[]>([])
  const busy = log.some(x => x.a === null && !x.err)
  const ask = async (question: string) => {
    const text = question.trim()
    if (text.length < 3 || busy) return
    setQ('')
    setLog(l => [...l, { q: text, a: null }])
    const set = (patch: Partial<QA>) => setLog(l => l.map((x, i) => i === l.length - 1 ? { ...x, ...patch } : x))
    try { set({ a: (await api.ask(s.elder.elderId, text)).answer }) }
    catch (e) { set({ err: e instanceof Error ? e.message : 'Couldn’t answer right now — try again' }) }
  }
  const SUGGEST = [`Has ${nk} been sleeping well?`, 'Any missed medicines?', 'Anything worrying this week?']
  return (
    <div className="card ask">
      <p className="eyebrow">✨ Ask about {nk}</p>
      <p className="small muted" style={{ margin: '4px 0 10px' }}>Answers come from the last two weeks of check-ins and what the helper did.</p>
      {log.map((x, i) => (
        <div key={i} className="ask-qa">
          <p className="ask-q">{x.q}</p>
          {x.err ? <p className="small" role="alert">⚠️ {x.err}</p>
            : x.a === null ? <p className="ask-a typing"><span className="dots" aria-label="Thinking"><i /><i /><i /></span></p>
              : <p className="ask-a">{x.a}</p>}
        </div>
      ))}
      {log.length === 0 && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {SUGGEST.map(t => <button key={t} className="btn sm" style={{ borderRadius: 999 }} onClick={() => void ask(t)}>{t}</button>)}
        </div>
      )}
      <form className="p-form" onSubmit={e => { e.preventDefault(); void ask(q) }}>
        <input value={q} maxLength={200} onChange={e => setQ(e.target.value)} placeholder={`e.g. Has ${nk} been eating properly?`} aria-label={`Ask about ${nk}`} />
        <button className="btn pri" type="submit" disabled={busy || q.trim().length < 3}>Ask</button>
      </form>
    </div>
  )
}
