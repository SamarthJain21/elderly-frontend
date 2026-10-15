import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { isLive } from '../data/mode'
import { nick, useDemo } from '../data/store'
import { cancelPlan, creditCalls, quotaLeft, quotaTotal, resumePlan, subscribe, topUp } from '../data/actions'
import { formatMoney, LOCAL_WALLET, usdToLocalMinor } from '../lib/money'
import { CREDIT, formatBalance, formatUsd, PLANS, planById, priceFor, type Billing, type PlanId } from '../lib/plans'
import { ComingSoon, MockQR, useToast } from '../components/ui'
import { CHead } from '../caretaker/CaretakerApp'

// ---------------- Plan cards (shared by billing, onboarding and the public pricing page) ----------------
/** Prices are in USD for everyone; local wallets show an approximate local amount at checkout. */
export function PlanCards({ cycle, current, onChoose, compact }: {
  cycle: Billing; current?: PlanId; onChoose: (p: PlanId) => void; compact?: boolean
}) {
  return (
    <div className="stack" style={{ gap: 16 }}>
      {PLANS.map(p => {
        const price = priceFor(p, cycle)
        const isCur = p.id === current
        return (
          <div key={p.id} className={`plan ${p.highlight ? 'hl' : ''} ${p.id === 'pro' ? 'pro' : ''} ${isCur ? 'current' : ''}`}>
            {p.highlight && !isCur && <span className="ribbon">Most popular</span>}
            {p.id === 'pro' && !isCur && <span className="ribbon">Best value</span>}
            {isCur && <span className="ribbon" style={{ background: 'var(--blue)' }}>Current plan</span>}
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div className="grow"><h3 style={{ fontSize: 22 }}>{p.id === 'pro' ? '★ ' : ''}{p.name}</h3><p className="small muted">{p.tagline}</p></div>
              <div style={{ textAlign: 'right' }}>
                <p className="price">{price === 0 ? 'Free' : formatUsd(price)}{price > 0 && <small> /{cycle === 'yearly' ? 'yr' : 'mo'}</small>}</p>
                {price > 0 && cycle === 'yearly' && <p className="small" style={{ color: 'var(--accent)', fontWeight: 700 }}>2 months free</p>}
              </div>
            </div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              <span className="pill info">🤝 {p.volunteerCalls} volunteer calls/mo</span>
              {p.medicineDiscountPct > 0 && <span className="pill gold">💊 {p.medicineDiscountPct}% off medicine</span>}
            </div>
            {!compact && <ul>{p.features.map(f => <li key={f}>{f}</li>)}</ul>}
            <button className={`btn block ${isCur ? '' : p.id === 'pro' ? 'gold' : p.highlight ? 'acc' : 'pri'}`} disabled={isCur} onClick={() => onChoose(p.id)}>
              {isCur ? 'Your plan' : p.id === 'basic' ? (current && current !== 'basic' ? 'Switch to Basic' : 'Continue with Basic') : `Choose ${p.name}`}
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function CycleToggle({ cycle, setCycle }: { cycle: Billing; setCycle: (c: Billing) => void }) {
  return (
    <div className="segbar" role="radiogroup" aria-label="Billing period">
      <button role="radio" aria-checked={cycle === 'monthly'} className={cycle === 'monthly' ? 'on' : ''} onClick={() => setCycle('monthly')}>Monthly</button>
      <button role="radio" aria-checked={cycle === 'yearly'} className={cycle === 'yearly' ? 'on' : ''} onClick={() => setCycle('yearly')}>Yearly <span className="pill ok" style={{ padding: '1px 6px', marginLeft: 4 }}>−17%</span></button>
    </div>
  )
}

// ---------------- Plan & billing page ----------------
/** Live mode: payments aren't in the backend yet — show what's coming. */
function PlanComingSoon() {
  const [cycle, setCycle] = useState<Billing>('monthly')
  return (
    <>
      <CHead title="Care credit & plan" back="/caretaker/more" />
      <div className="scroll"><div className="c-body">
        <div className="card stack" style={{ gap: 6 }}>
          <p className="eyebrow">Current plan</p><h2 style={{ fontSize: 26 }}>Free</h2>
          <p className="small muted">AI helper, family chat, daily check-ins and emergency alerts — free, no card on file.</p>
        </div>
        <ComingSoon card title="Care credit, top-ups and plans">
          Prepaid credit for volunteer visits ($1 per call after the free ones, top up from $5, emergencies never blocked) and the Premium / Pro plans are on the way. Here’s a preview — nothing can be bought yet.
        </ComingSoon>
        <div className="row" style={{ flexWrap: 'wrap' }}><span className="grow small muted">Preview · prices in USD</span><CycleToggle cycle={cycle} setCycle={setCycle} /></div>
        <div className="soon-dim" aria-hidden><PlanCards cycle={cycle} onChoose={() => {}} compact /></div>
      </div></div>
    </>
  )
}

export function PlanPage() {
  if (isLive()) return <PlanComingSoon />
  return <PlanPageDemo />
}

function PlanPageDemo() {
  const s = useDemo()
  const nav = useNavigate()
  const toast = useToast()
  const [cycle, setCycle] = useState<Billing>(s.billing.cycle)
  const cur = s.rules.currency
  const plan = planById(s.billing.plan)
  const left = quotaLeft(s), total = quotaTotal(s)
  const renew = new Date(s.billing.renewsOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const saved = s.actions.reduce((sum, a) => sum + (a.status === 'done' ? a.discountMinor ?? 0 : 0), 0)
  const pm = s.billing.paymentMethod
  return (
    <>
      <CHead title="Care credit & plan" back="/caretaker/more" />
      <div className="scroll"><div className="c-body">
        <CreditCard />
        <div className="card stack" style={{ gap: 10 }}>
          <div className="row"><div className="grow"><p className="eyebrow">Current plan</p><h2 style={{ fontSize: 26 }}>{plan.id === 'pro' ? '★ ' : ''}{plan.name}</h2></div>
            {plan.id !== 'basic' && <span className={`pill ${s.billing.cancelAtPeriodEnd ? 'warn' : 'ok'}`}>{s.billing.cancelAtPeriodEnd ? `Ends ${renew}` : `Renews ${renew}`}</span>}</div>
          <div>
            <div className="row"><span className="small grow" style={{ fontWeight: 700 }}>Volunteer calls this month</span><span className="small"><b>{s.billing.volunteerUsed}</b> used · <b>{left}</b> left</span></div>
            <div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${Math.min(100, (s.billing.volunteerUsed / Math.max(1, total)) * 100)}%`, background: left === 0 ? 'var(--sos)' : left <= 2 ? 'var(--amber)' : undefined }} /></div>
            <p className="small muted" style={{ marginTop: 4 }}>After the free calls, each call is {formatUsd(CREDIT.callPriceUsd)} from care credit.</p>
          </div>
          {plan.medicineDiscountPct > 0 && <p className="small">💊 {saved > 0 ? <>Medicine discount saved you <b>{formatMoney(saved, cur)}</b> this month</> : <>{plan.medicineDiscountPct}% off every medicine order + free delivery</>}</p>}
        </div>

        <div className="row" style={{ flexWrap: 'wrap' }}><div className="grow"><h3 style={{ fontSize: 20 }}>Save with a plan</h3><p className="small muted">More free calls every month, so credit lasts longer</p></div><CycleToggle cycle={cycle} setCycle={setCycle} /></div>
        <PlanCards cycle={cycle} current={s.billing.plan}
          onChoose={id => id === 'basic' ? (cancelPlan(), toast('You’ll move to Basic at the end of this period')) : nav(`/caretaker/checkout/${id}?cycle=${cycle}`)} />

        <div className="card">
          <p className="eyebrow">Payment method</p>
          <div className="row" style={{ marginTop: 8 }}>
            <span style={{ fontSize: 24 }}>{pm?.kind === 'wallet' ? '📱' : '💳'}</span>
            <p className="grow">{!pm ? <span className="muted">None yet</span> : pm.kind === 'card' ? `${pm.brand} •••• ${pm.last4}` : pm.label}</p>
          </div>
        </div>
        <UsageHistory />
        <div className="card">
          <p className="eyebrow">Receipts</p>
          {s.billing.invoices.length === 0 && <p className="small muted" style={{ marginTop: 6 }}>No payments yet.</p>}
          {s.billing.invoices.map(i => (
            <div key={i.id} className="list-row"><span>🧾</span><div className="grow"><p className="t">{i.description}</p><p className="s">{new Date(i.date).toLocaleDateString('en-GB')} · {i.id} · {i.method}</p></div><b>{formatUsd(i.amountMinor)}</b></div>
          ))}
        </div>
        {plan.id !== 'basic' && (s.billing.cancelAtPeriodEnd
          ? <button className="btn" onClick={() => { resumePlan(); toast('Your plan will renew as normal') }}>Keep my {plan.name} plan</button>
          : <button className="btn ghost" style={{ color: 'var(--sos)' }} onClick={() => { cancelPlan(); toast(`Cancelled — you keep ${plan.name} until ${renew}`) }}>Cancel plan</button>)}
        <p className="small muted center">Prices in USD, tax included. Free calls reset on the 1st of each month; care credit never expires. Cancel any time.</p>
      </div></div>
    </>
  )
}

// ---------------- Checkout (mock, Stripe-style) ----------------
type Step = 'pay' | 'processing' | 'done'

export function Checkout() {
  if (isLive()) return <Navigate to="/caretaker/plan" replace />
  return <CheckoutDemo />
}

function CheckoutDemo() {
  const s = useDemo()
  const nav = useNavigate()
  const { planId } = useParams<{ planId: string }>()
  const [params] = useSearchParams()
  const cycle = (params.get('cycle') as Billing) || 'monthly'
  const isTopUp = planId === 'topup'
  const plan = planById(isTopUp ? 'basic' : (planId as PlanId) || 'premium')
  const cur = s.rules.currency
  const wallet = LOCAL_WALLET[cur]
  const amount = isTopUp ? Math.max(CREDIT.minTopUpUsd, Number(params.get('amount')) || CREDIT.minTopUpUsd) : priceFor(plan, cycle)
  const after = s.billing.balance + amount
  const approxLocal = `≈ ${formatMoney(usdToLocalMinor(amount, cur), cur)}`
  const [method, setMethod] = useState<'card' | 'wallet'>('card')
  const [card, setCard] = useState({ number: '', exp: '', cvc: '', name: s.caretaker.name })
  const [step, setStep] = useState<Step>('pay')
  const [err, setErr] = useState('')

  const digits = card.number.replace(/\D/g, '')
  const brand = /^4/.test(digits) ? 'Visa' : /^5[1-5]/.test(digits) ? 'Mastercard' : /^3[47]/.test(digits) ? 'Amex' : 'Card'
  const fmtNum = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
  const fmtExp = (v: string) => { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }

  const pay = () => {
    if (method === 'card' && (digits.length < 15 || card.exp.length < 5 || card.cvc.length < 3)) { setErr('Please complete your card details (use the test card below).'); return }
    setErr(''); setStep('processing')
    setTimeout(() => {
      const pm = method === 'card' ? { kind: 'card' as const, brand, last4: digits.slice(-4) } : { kind: 'wallet' as const, label: wallet.label }
      if (isTopUp) topUp(amount, pm); else subscribe(plan.id, cycle, pm)
      setStep('done')
    }, 1800)
  }

  if (step === 'processing') return (
    <div className="scroll"><div className="success" style={{ paddingTop: 120 }}><div className="spinner" /><b>Confirming payment…</b><p className="small muted">Don’t close this screen</p></div></div>
  )
  if (step === 'done') return (
    <div className="scroll"><div className="success" style={{ paddingTop: 60 }}>
      <div className="tick">✓</div>
      {isTopUp ? <>
        <h1 style={{ fontSize: 30 }}>Credit added!</h1>
        <p className="muted">Care credit is now <b>{formatBalance(s.billing.balance)}</b> — enough for <b>{creditCalls(s)} volunteer calls</b> after {nick(s)}’s free ones.</p>
      </> : <>
        <h1 style={{ fontSize: 30 }}>Welcome to {plan.name}!</h1>
        <p className="muted">{nick(s)} now has <b>{plan.volunteerCalls} free volunteer calls</b> a month{plan.medicineDiscountPct ? <> and <b>{plan.medicineDiscountPct}% off medicine</b></> : null}.</p>
      </>}
      <div className="card" style={{ width: '100%', textAlign: 'left' }}>
        <div className="row"><span className="grow muted small">Paid</span><b>{formatUsd(amount)}</b></div>
        <div className="row" style={{ marginTop: 6 }}><span className="grow muted small">Receipt</span><span className="small">{s.billing.invoices[0]?.id}</span></div>
        {isTopUp
          ? <div className="row" style={{ marginTop: 6 }}><span className="grow muted small">New balance</span><b>{formatBalance(s.billing.balance)}</b></div>
          : <div className="row" style={{ marginTop: 6 }}><span className="grow muted small">Next payment</span><span className="small">{new Date(s.billing.renewsOn).toLocaleDateString('en-GB')}</span></div>}
      </div>
      {s.onboarded.elder
        ? <button className="btn pri block" onClick={() => nav('/caretaker')}>Back to Home</button>
        : <button className="btn pri block" onClick={() => nav('/caretaker/setup-phone')}>Next: set up {nick(s)}’s phone →</button>}
      <Link to="/caretaker/plan" className="small">View billing</Link>
    </div></div>
  )

  return (
    <>
      <CHead title="Checkout" back="/caretaker/plan" right={<span className="testbadge">TEST MODE</span>} />
      <div className="scroll"><div className="c-body">
        {isTopUp ? (
          <div className="card row">
            <span style={{ fontSize: 30 }}>💳</span>
            <div className="grow"><b>Care credit top-up</b><p className="small muted">Balance after: {formatBalance(after)}{s.billing.balance < 0 ? ` (repays ${formatUsd(-s.billing.balance)} emergency use)` : ''}</p></div>
            <b style={{ fontSize: 20 }}>{formatUsd(amount)}</b>
          </div>
        ) : (
          <div className="card row">
            <span style={{ fontSize: 30 }}>{plan.id === 'pro' ? '★' : '✨'}</span>
            <div className="grow"><b>{plan.name} — {cycle === 'yearly' ? 'yearly' : 'monthly'}</b><p className="small muted">{plan.volunteerCalls} free volunteer calls/mo{plan.medicineDiscountPct ? ` · ${plan.medicineDiscountPct}% off medicine` : ''}</p></div>
            <b style={{ fontSize: 20 }}>{formatUsd(amount)}</b>
          </div>
        )}

        <p className="eyebrow">Pay with</p>
        <button className={`paym ${method === 'card' ? 'on' : ''}`} onClick={() => setMethod('card')}><span className="radio" /><span className="grow"><b>Card</b><br /><span className="small muted">Visa, Mastercard, Amex</span></span><span>💳</span></button>
        <button className={`paym ${method === 'wallet' ? 'on' : ''}`} onClick={() => setMethod('wallet')}><span className="radio" /><span className="grow"><b>{wallet.label}</b><br /><span className="small muted">{wallet.hint} · {approxLocal}</span></span><span>📱</span></button>

        {method === 'card' ? (
          <div className="stack">
            <div className="cardvis">
              <div className="row"><span className="grow" style={{ fontFamily: 'Fraunces, serif' }}>Elderly</span><span>{brand}</span></div>
              <div className="num">{fmtNum(card.number) || '•••• •••• •••• ••••'}</div>
              <div className="row small"><span className="grow">{card.name.toUpperCase() || 'NAME'}</span><span>{card.exp || 'MM/YY'}</span></div>
            </div>
            <label className="field">Card number<input inputMode="numeric" autoComplete="off" placeholder="4242 4242 4242 4242" value={fmtNum(card.number)} onChange={e => setCard({ ...card, number: e.target.value })} /></label>
            <div className="row">
              <label className="field grow">Expiry<input inputMode="numeric" autoComplete="off" placeholder="MM/YY" value={card.exp} onChange={e => setCard({ ...card, exp: fmtExp(e.target.value) })} /></label>
              <label className="field grow">CVC<input inputMode="numeric" autoComplete="off" placeholder="123" value={card.cvc} onChange={e => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '').slice(0, 4) })} /></label>
            </div>
            <label className="field">Name on card<input autoComplete="off" value={card.name} onChange={e => setCard({ ...card, name: e.target.value })} /></label>
            <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setCard({ ...card, number: '4242424242424242', exp: '12/34', cvc: '123' })}>Use test card 4242…</button>
          </div>
        ) : (
          <div className="card stack" style={{ alignItems: 'center', textAlign: 'center' }}>
            <div className="qrbox"><MockQR seed={wallet.id + amount} size={170} /></div>
            <p className="small muted">Scan with your banking app to pay <b>{approxLocal}</b> ({formatUsd(amount)}), then tap “I’ve paid”.</p>
          </div>
        )}
        {err && <p className="small" style={{ color: 'var(--sos)', fontWeight: 700 }} role="alert">{err}</p>}
        <button className={`btn block ${plan.id === 'pro' ? 'gold' : 'acc'}`} style={{ minHeight: 54, fontSize: 17 }} onClick={pay}>
          {method === 'card' ? `Pay ${formatUsd(amount)}` : 'I’ve paid'}
        </button>
        <p className="small muted center">🔒 Prototype — no real payment is taken. In production this is a Stripe Checkout / Payment Element; card details never touch our servers.</p>
      </div></div>
    </>
  )
}

// ---------------- Care credit (prepaid, top up first) ----------------
/** Amount chips — $5 minimum. Used on the billing page and in onboarding. */
export function TopUpPicker({ value, onChange }: { value: number; onChange: (cents: number) => void }) {
  return (
    <div className="chips-pick" role="radiogroup" aria-label="Top-up amount">
      {CREDIT.options.map(c => (
        <button key={c} role="radio" aria-checked={value === c} className={value === c ? 'on' : ''} onClick={() => onChange(c)}>
          {formatUsd(c)}{c === CREDIT.minTopUpUsd ? <span style={{ fontWeight: 400, opacity: .8 }}> · min</span> : null}
        </button>
      ))}
    </div>
  )
}

export function CreditCard() {
  const s = useDemo()
  const nav = useNavigate()
  const [amount, setAmount] = useState(1000)
  const b = s.billing.balance
  const negative = b < 0
  const low = !negative && b < CREDIT.callPriceUsd * 2
  return (
    <div className="card stack" style={{ gap: 10, ...(negative ? { borderColor: 'var(--sos)', background: 'var(--sos-soft)' } : {}) }}>
      <div className="row">
        <div className="grow"><p className="eyebrow">Care credit</p>
          <p className="quota" style={{ marginTop: 4 }}><b style={{ color: negative ? 'var(--sos)' : undefined }}>{formatBalance(b)}</b><span>prepaid</span></p></div>
        <span className={`pill ${negative ? 'bad' : low ? 'warn' : 'ok'}`}>{negative ? 'Emergency use' : low ? 'Running low' : `${creditCalls(s)} paid calls`}</span>
      </div>
      {negative && <p className="small"><b>Emergency help went ahead even though credit had run out.</b> Top up to repay {formatUsd(-b)} — other requests wait until the balance is positive.</p>}
      {!negative && <p className="small muted">Top up first, then pay as you go: {formatUsd(CREDIT.callPriceUsd)} per volunteer call after the free ones. Emergencies are never blocked — credit can dip to {formatBalance(CREDIT.emergencyFloorUsd)}.</p>}
      <TopUpPicker value={amount} onChange={setAmount} />
      <button className="btn acc block" onClick={() => nav(`/caretaker/checkout/topup?amount=${amount}`)}>Top up {formatUsd(amount)}</button>
    </div>
  )
}

function UsageHistory() {
  const s = useDemo()
  const IC = { topup: '➕', included: '🎁', call: '🤝', emergency: '🚨' } as const
  return (
    <div className="card">
      <p className="eyebrow">Credit history</p>
      {s.billing.ledger.length === 0 && <p className="small muted" style={{ marginTop: 6 }}>Nothing yet.</p>}
      {s.billing.ledger.slice(0, 12).map(l => (
        <div key={l.id} className="list-row"><span>{IC[l.kind]}</span>
          <div className="grow"><p className="t" style={{ fontSize: 14.5 }}>{l.description}</p><p className="s">{new Date(l.date).toLocaleDateString('en-GB')}</p></div>
          <b style={{ color: l.amount > 0 ? 'var(--accent)' : l.kind === 'emergency' ? 'var(--sos)' : undefined }}>{l.amount === 0 ? 'Free' : (l.amount > 0 ? '+' : '') + formatBalance(l.amount)}</b>
        </div>
      ))}
    </div>
  )
}
