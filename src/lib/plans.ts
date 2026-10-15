
export type PlanId = 'basic' | 'premium' | 'pro'
export type Billing = 'monthly' | 'yearly'

export interface Plan {
  id: PlanId
  name: string
  tagline: string
  /** Monthly price in US cents (0 = free). Subscriptions are billed in USD everywhere; yearly = 10× monthly. */
  priceUsd: number
  volunteerCalls: number
  familySeats: number
  medicineDiscountPct: number
  features: string[]
  highlight?: boolean
}

export const PLANS: Plan[] = [
  {
    id: 'basic', name: 'Basic', tagline: 'Everything AI, free forever',
    priceUsd: 0,
    volunteerCalls: 5, familySeats: 2, medicineDiscountPct: 0,
    features: [
      'AI voice assistant — speech-to-text & text-to-speech',
      'Family chat with voice read-aloud & one-tap replies',
      'Daily check-ins and medicine reminders',
      'Hold-for-help emergency button',
      '5 free volunteer calls / month, then $1 each from care credit',
      '2 family members',
    ],
  },
  {
    id: 'premium', name: 'Premium', tagline: 'More help, more family',
    priceUsd: 699,
    volunteerCalls: 20, familySeats: 4, medicineDiscountPct: 0, highlight: true,
    features: [
      'Everything in Basic',
      '20 volunteer calls / month',
      'Up to 4 family members',
      'Daily AI wellbeing summary for family',
      'Priority volunteer matching',
    ],
  },
  {
    id: 'pro', name: 'Pro', tagline: 'Complete peace of mind',
    priceUsd: 1499,
    volunteerCalls: 50, familySeats: 8, medicineDiscountPct: 10,
    features: [
      'Everything in Premium',
      '50 volunteer calls / month',
      '10% off every medicine order + free delivery',
      'Up to 8 family members',
      'Weekly health & mood report (PDF)',
      'Dedicated care coordinator line',
    ],
  },
]

export const planById = (id: PlanId) => PLANS.find(p => p.id === id)!

/** Price in US cents. */
export function priceFor(plan: Plan, billing: Billing): number {
  return billing === 'yearly' ? plan.priceUsd * 10 : plan.priceUsd
}

/** "$6.99", "$69.90", "$0" */
export const formatUsd = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`

/**
 * Prepaid "care credit" (top up first). Free monthly calls are used first, then each volunteer call is paid
 * from credit. Normal requests need enough credit; emergencies are never blocked and may take the balance
 * negative, down to the emergency floor. The next top-up repays it first.
 */
export const CREDIT = {
  minTopUpUsd: 500,                     // $5 minimum top-up
  options: [500, 1000, 2000, 5000],     // $5 · $10 · $20 · $50
  callPriceUsd: 100,                    // $1 per volunteer call beyond the free ones
  emergencyFloorUsd: -1000,             // balance may go down to −$10 for emergencies only
}
/** "$5", "−$3.50" */
export const formatBalance = (cents: number) => (cents < 0 ? '−' : '') + formatUsd(Math.abs(cents))
