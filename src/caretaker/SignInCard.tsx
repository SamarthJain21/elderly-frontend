import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, newSetupLink } from '../data/live'
import { SANDBOX_FRAME } from '../data/mode'
import { nick, useDemo } from '../data/store'
import { useToast } from '../components/ui'
import { pinProblem } from '../lib/pin'

/** How {nick} gets back in: a PIN for any phone, or a fresh setup link (app/routers/elder_access.py). */
export function SignInCard() {
  const s = useDemo()
  const nk = nick(s)
  const toast = useToast()
  const nav = useNavigate()
  const [hasPin, setHasPin] = useState<boolean | null>(null)
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [signOutOthers, setSignOutOthers] = useState(false)
  useEffect(() => { if (!SANDBOX_FRAME) api.pinStatus(s.live.elderId!).then(r => setHasPin(r.set), () => setHasPin(null)) }, [s.live.elderId])
  const problem = pin ? pinProblem(pin) : null
  // Not in /try: sandbox numbers are fake (+000) and couldn't be typed at sign-in.
  if (SANDBOX_FRAME) return null
  const savePin = async () => {
    setBusy(true)
    try { await api.setPin(s.live.elderId!, pin); setHasPin(true); setPin(''); toast(`PIN saved — tell ${nk} it, and the phone number ${s.elder.phone}`) }
    catch (e) { toast(e instanceof Error ? e.message : 'Couldn’t save the PIN') } finally { setBusy(false) }
  }
  const relink = async () => {
    setBusy(true)
    try { await newSetupLink(signOutOthers); nav('/caretaker/setup-phone') }
    catch (e) { toast(e instanceof Error ? e.message : 'Couldn’t make a new link') } finally { setBusy(false) }
  }
  return (
    <div className="card stack" style={{ gap: 12 }}>
      <p className="eyebrow">Signing in</p>
      <div>
        <b>Sign-in PIN</b> <span className={`pill ${hasPin ? 'ok' : 'info'}`} style={{ marginLeft: 6 }}>{hasPin ? '✓ Set' : hasPin === false ? 'Not set' : '…'}</span>
        <p className="small muted" style={{ marginTop: 4 }}>{nk} can sign in on any phone with their number ({s.elder.phone}) and this PIN. {nk} can also change it from “My day”.</p>
        <form className="p-form" style={{ marginTop: 8 }} onSubmit={e => { e.preventDefault(); if (!problem) void savePin() }}>
          <input className="pin-input" type="password" inputMode="numeric" maxLength={6} placeholder={hasPin ? 'New PIN, 4–6 digits' : '4–6 digits'} aria-label="Sign-in PIN"
            value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
          <button className="btn pri" disabled={busy || !pin || !!problem}>{hasPin ? 'Change' : 'Set PIN'}</button>
        </form>
        {problem === 'weak' && <p className="small" style={{ color: 'var(--amber)', marginTop: 4 }}>Pick something harder to guess than 1111 or 1234.</p>}
      </div>
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
        <b>New setup link</b>
        <p className="small muted" style={{ marginTop: 4 }}>For a new phone, or if {nk} got signed out. The old link stops working.</p>
        <label className="row small" style={{ gap: 8, margin: '8px 0', fontWeight: 600 }}><input type="checkbox" checked={signOutOthers} onChange={e => setSignOutOthers(e.target.checked)} /> Also sign out other phones (lost phone)</label>
        <button className="btn" disabled={busy} onClick={() => void relink()}>🔗 Make a new setup link</button>
      </div>
    </div>
  )
}
