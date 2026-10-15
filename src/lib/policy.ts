import type { AutonomyRules, Currency, Decision, Mode, ToolName } from './types'

// Port of app/autonomy.py so the demo behaves exactly like the backend. The backend stays the source of truth.
export const SPENDING_TOOLS = new Set<string>(['order_food', 'order_medicine', 'book_ride'])
export const ALWAYS_EXECUTE = new Set<string>(['escalate_emergency', 'check_weather', 'call_contact'])

const DEFAULT_LIMITS: Record<Currency, Record<string, number>> = {
  INR: { order_food: 50_000, order_medicine: 200_000, book_ride: 100_000 },
  THB: { order_food: 15_000, order_medicine: 60_000, book_ride: 30_000 },
  SGD: { order_food: 2_000, order_medicine: 8_000, book_ride: 4_000 },
}

export function defaultRules(currency: Currency): AutonomyRules {
  const l = DEFAULT_LIMITS[currency]
  return {
    currency, trustedVolunteersOnly: true,
    tools: {
      order_food: { mode: 'elder_confirm', limitMinor: l.order_food },
      order_medicine: { mode: 'elder_confirm', limitMinor: l.order_medicine },
      book_ride: { mode: 'elder_confirm', limitMinor: l.book_ride },
      notify_volunteer: { mode: 'caretaker_approve', limitMinor: null },
      send_message_to_caretaker: { mode: 'autonomous', limitMinor: null },
      set_reminder: { mode: 'autonomous', limitMinor: null },
    },
  }
}

export function decide(tool: string, rules: AutonomyRules, costMinor: number | null = null): Decision {
  if (ALWAYS_EXECUTE.has(tool)) return 'execute'
  const rule = rules.tools[tool as ToolName]
  if (!rule) return 'caretaker_approve'
  if (rule.mode === 'blocked') return 'block'
  if (SPENDING_TOOLS.has(tool) && (costMinor == null || rule.limitMinor == null || costMinor > rule.limitMinor)) {
    return 'caretaker_approve'
  }
  return ({ autonomous: 'execute', elder_confirm: 'ask_elder', caretaker_approve: 'caretaker_approve' } as const)[
    rule.mode as Exclude<Mode, 'blocked'>
  ]
}

export const MODE_LABEL: Record<Mode, { l: string; s: string }> = {
  autonomous: { l: 'Do it right away', s: 'Helper acts, then tells {nick}' },
  elder_confirm: { l: 'Ask {nick} first', s: '“Shall I…?” Yes / No' },
  caretaker_approve: { l: 'Ask me first', s: 'You approve on your phone' },
  blocked: { l: 'Never', s: 'Refuse and tell me' },
}

export const TOOL_META: Record<ToolName, { ic: string; label: string; ex: string }> = {
  order_medicine: { ic: '💊', label: 'Order medicine', ex: '“Order my blood pressure pills”' },
  order_food: { ic: '🍲', label: 'Order food', ex: '“I’m hungry”, “order dinner”' },
  book_ride: { ic: '🚕', label: 'Book a ride', ex: '“Take me to the clinic”' },
  notify_volunteer: { ic: '🤝', label: 'Ask a volunteer for help', ex: '“My tap is leaking”' },
  send_message_to_caretaker: { ic: '💬', label: 'Message family', ex: '“Tell Emma I’m fine”' },
  set_reminder: { ic: '⏰', label: 'Set a reminder', ex: '“Remind me at 5 to call Tom”' },
}
