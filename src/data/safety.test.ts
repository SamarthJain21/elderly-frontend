// Safety-critical live-mode behaviour: SOS honesty, no keyword false alarms, rules saved to the right elder.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Node has no browser globals: the live layer only needs timers and document.hidden.
vi.stubGlobal('window', globalThis)
vi.stubGlobal('document', { hidden: false })
vi.stubGlobal('location', { protocol: 'http:', host: 'localhost', search: '', pathname: '/' })
// No real network in unit tests: a WebSocket that never connects.
vi.stubGlobal('WebSocket', class { static OPEN = 1; readyState = 0; onopen = null; onmessage = null; onclose = null; send() {} close() {} })

const sos = vi.fn()
const say = vi.fn()
const saveRules = vi.fn((_elderId: string, _rules: unknown) => Promise.resolve())

vi.mock('./mode', () => ({ isLive: () => true, MODE: 'live', API_URL: '/api', switchMode: () => {}, SANDBOX_FRAME: false, EMBEDDED: false }))
vi.mock('../lib/firebase', () => ({ auth: { currentUser: null, onAuthStateChanged: () => () => {} }, googleProvider: {}, getToken: () => Promise.resolve('t'), firebaseReady: true, isSandboxSigningIn: () => false, sandboxSignIn: null }))
const notify = vi.fn()
vi.mock('../components/ui', async (orig) => ({ ...(await orig<typeof import('../components/ui')>()), notify: (m: string) => notify(m) }))
vi.mock('./api', async (orig) => ({
  ...(await orig<typeof import('./api')>()),
  createApi: () => new Proxy({ saveRules }, { get: (t, k) => (t as Record<string, unknown>)[k as string] ?? (() => Promise.resolve(null)) }),
}))

const { getState, update } = await import('./store')
const live = await import('./live')
const actions = await import('./actions')

beforeEach(() => {
  vi.useFakeTimers()
  live.live.sos = sos as never
  live.live.say = say as never
  update(d => { d.elderUi.overlay = null; d.live.elderId = 'elder-A'; d.elder.elderId = 'elder-A' })
})
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

describe('SOS', () => {
  it('only says "alerted" after the backend confirms', async () => {
    let resolve!: (v: unknown) => void
    sos.mockReturnValue(new Promise(r => { resolve = r }))
    actions.triggerHelp()
    expect(getState().elderUi.overlay).toMatchObject({ type: 'emergency', sending: true })
    expect((getState().elderUi.overlay as { alerted?: boolean }).alerted).toBeFalsy()
    resolve({ alert: { id: 'alert_1', status: 'active' }, emergencyNumber: '112', firstContact: null })
    await vi.waitFor(() => expect(getState().elderUi.overlay).toMatchObject({ alerted: true, alertId: 'alert_1' }))
  })

  it('shows "couldn\'t reach your family" when the alert fails — never "alerted"', async () => {
    sos.mockRejectedValue(new Error('offline'))
    actions.triggerHelp()
    await vi.waitFor(() => expect(getState().elderUi.overlay).toMatchObject({ failed: true }))
    expect((getState().elderUi.overlay as { alerted?: boolean }).alerted).toBeFalsy()
  })
})

describe('no keyword false alarms', () => {
  it.each(['I fell asleep early', 'Can you help me order dinner?', 'The fall weather is lovely'])('"%s" goes to the agent', (text) => {
    actions.elderSay(text)
    expect(say).toHaveBeenCalledWith(text)
    expect(getState().elderUi.overlay).toBeNull()
  })
})

describe('rules', () => {
  it('a pending rules edit is saved to the elder it was made for, even after switching', async () => {
    update(d => { d.rules.tools.order_food.limitMinor = 12_300 })
    live.live.saveRulesSoon()
    await live.selectElder('elder-B')  // switch before the 600 ms timer
    expect(saveRules).toHaveBeenCalledTimes(1)
    expect(saveRules.mock.calls[0][0]).toBe('elder-A')
    expect((saveRules.mock.calls[0][1] as unknown as { tools: { order_food: { limitMinor: number } } }).tools.order_food.limitMinor).toBe(12_300)
    vi.advanceTimersByTime(1000)
    expect(saveRules).toHaveBeenCalledTimes(1)  // nothing else saved to B
  })
})

describe('family app', () => {
  it('shows an SOS the moment it happens, not on the next 15 s poll', () => {
    update(d => { d.live.role = 'caretaker'; d.elder.name = 'Rose' })
    live.onFrameForTests({ type: 'alert', alert: { id: 'a1', source: 'sos_button', description: '', status: 'active' } })
    expect(notify).toHaveBeenCalledWith('🚨 Rose pressed SOS')
  })

  it('the elder\'s own app doesn\'t toast their own alert', () => {
    update(d => { d.live.role = 'elder' })
    live.onFrameForTests({ type: 'alert', alert: { id: 'a2', source: 'agent', description: 'fell', status: 'active' } })
    expect(notify).not.toHaveBeenCalled()
  })
})
