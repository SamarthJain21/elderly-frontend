import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, type Firestore } from 'firebase/firestore'

let env: RulesTestEnvironment

const ELDER = 'elder1'
const OTHER_ELDER = 'elder2'
const CARETAKER = 'care1'
const STRANGER = 'care2' // a caretaker, but not of ELDER

const validRules = {
  currency: 'INR',
  tools: {
    order_food: { mode: 'autonomous', limitMinor: 50000 },
    order_medicine: { mode: 'elder_confirm', limitMinor: 200000 },
    book_ride: { mode: 'elder_confirm', limitMinor: 100000 },
  },
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-elderly',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8085 },
  })
})

afterAll(async () => {
  await env.cleanup()
})

async function seed(tier: 'alerts_only' | 'daily_summary' | 'full_access' = 'daily_summary') {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', ELDER), { role: 'elder' })
    await setDoc(doc(db, 'users', OTHER_ELDER), { role: 'elder' })
    await setDoc(doc(db, 'users', CARETAKER), { role: 'caretaker' })
    await setDoc(doc(db, 'users', STRANGER), { role: 'caretaker' })
    await setDoc(doc(db, 'elders', ELDER), { name: 'Rose', caretakerIds: [CARETAKER], sharingTier: tier })
    await setDoc(doc(db, 'elders', OTHER_ELDER), { name: 'Ann', caretakerIds: [STRANGER], sharingTier: 'full_access' })
    await setDoc(doc(db, 'check_ins', 'c1'), { elderId: ELDER, mood: 'good' })
    await setDoc(doc(db, 'check_in_transcripts', 'c1'), { elderId: ELDER, rawTranscript: '...' })
    await setDoc(doc(db, 'elders', ELDER, 'logs', 'ok1'), { kind: 'ok', ack: false })
    await setDoc(doc(db, 'elders', ELDER, 'logs', 'alert1'), { kind: 'alert', ack: false })
    await setDoc(doc(db, 'elders', ELDER, 'actions', 'a1'), { status: 'awaiting_caretaker' })
    await setDoc(doc(db, 'rules', ELDER), validRules)
    await setDoc(doc(db, 'elders', ELDER, 'messages', 'm1'), { sender: 'elder', text: 'hi' })
  })
}

const as = (uid: string): Firestore => env.authenticatedContext(uid).firestore()
const anon = (): Firestore => env.unauthenticatedContext().firestore()

describe('identity', () => {
  beforeEach(() => seed())

  it('signed-out users can read nothing', async () => {
    await assertFails(getDoc(doc(anon(), 'elders', ELDER)))
    await assertFails(getDoc(doc(anon(), 'users', ELDER)))
  })

  it('users read only their own user doc', async () => {
    await assertSucceeds(getDoc(doc(as(ELDER), 'users', ELDER)))
    await assertFails(getDoc(doc(as(ELDER), 'users', CARETAKER)))
  })

  it('nobody can change their own role', async () => {
    await assertFails(updateDoc(doc(as(ELDER), 'users', ELDER), { role: 'caretaker' }))
    await assertFails(setDoc(doc(as('newbie'), 'users', 'newbie'), { role: 'caretaker' }))
  })

  it('elder and their caretaker read the elder profile; others cannot', async () => {
    await assertSucceeds(getDoc(doc(as(ELDER), 'elders', ELDER)))
    await assertSucceeds(getDoc(doc(as(CARETAKER), 'elders', ELDER)))
    await assertFails(getDoc(doc(as(STRANGER), 'elders', ELDER)))
    await assertFails(getDoc(doc(as(OTHER_ELDER), 'elders', ELDER)))
  })

  it('caretaker can edit profile fields but not caretakerIds', async () => {
    await assertSucceeds(updateDoc(doc(as(CARETAKER), 'elders', ELDER), { phone: '+91 99999' }))
    await assertFails(updateDoc(doc(as(CARETAKER), 'elders', ELDER), { caretakerIds: [CARETAKER, STRANGER] }))
    await assertFails(updateDoc(doc(as(CARETAKER), 'elders', ELDER), { sharingTier: 'everything' }))
  })

  it('elder cannot add themselves to another caretaker or edit own profile directly', async () => {
    await assertFails(updateDoc(doc(as(ELDER), 'elders', ELDER), { sharingTier: 'alerts_only' }))
  })
})

describe('sharing tiers', () => {
  it('alerts_only: caretaker sees alert logs only', async () => {
    await seed('alerts_only')
    const db = as(CARETAKER)
    await assertSucceeds(getDoc(doc(db, 'elders', ELDER, 'logs', 'alert1')))
    await assertFails(getDoc(doc(db, 'elders', ELDER, 'logs', 'ok1')))
    await assertFails(getDoc(doc(db, 'check_ins', 'c1')))
    await assertFails(getDoc(doc(db, 'check_in_transcripts', 'c1')))
  })

  it('daily_summary: check-ins yes, raw transcripts no', async () => {
    await seed('daily_summary')
    const db = as(CARETAKER)
    await assertSucceeds(getDoc(doc(db, 'check_ins', 'c1')))
    await assertSucceeds(getDoc(doc(db, 'elders', ELDER, 'logs', 'ok1')))
    await assertFails(getDoc(doc(db, 'check_in_transcripts', 'c1')))
  })

  it('full_access: raw transcripts readable', async () => {
    await seed('full_access')
    await assertSucceeds(getDoc(doc(as(CARETAKER), 'check_in_transcripts', 'c1')))
  })

  it('elder always reads own data regardless of tier', async () => {
    await seed('alerts_only')
    await assertSucceeds(getDoc(doc(as(ELDER), 'check_ins', 'c1')))
    await assertSucceeds(getDoc(doc(as(ELDER), 'check_in_transcripts', 'c1')))
  })

  it('a caretaker of a different elder sees nothing, even with full_access there', async () => {
    await seed('full_access')
    await assertFails(getDoc(doc(as(STRANGER), 'check_ins', 'c1')))
    await assertFails(getDoc(doc(as(STRANGER), 'elders', ELDER, 'logs', 'alert1')))
  })

  it('caretaker can ack a log but not rewrite it; clients cannot write check-ins', async () => {
    await seed()
    await assertSucceeds(updateDoc(doc(as(CARETAKER), 'elders', ELDER, 'logs', 'alert1'), { ack: true }))
    await assertFails(updateDoc(doc(as(CARETAKER), 'elders', ELDER, 'logs', 'alert1'), { kind: 'ok' }))
    await assertFails(setDoc(doc(as(ELDER), 'check_ins', 'c2'), { elderId: ELDER, mood: 'great' }))
  })
})

describe('chat messages', () => {
  it('elder reads own chat; nobody writes it from the client', async () => {
    await seed('alerts_only')
    await assertSucceeds(getDoc(doc(as(ELDER), 'elders', ELDER, 'messages', 'm1')))
    await assertFails(setDoc(doc(as(ELDER), 'elders', ELDER, 'messages', 'm2'), { sender: 'agent', text: 'fake' }))
    await assertFails(getDoc(doc(as(OTHER_ELDER), 'elders', ELDER, 'messages', 'm1')))
  })

  it('caretaker reads chat only at full_access', async () => {
    await seed('daily_summary')
    await assertFails(getDoc(doc(as(CARETAKER), 'elders', ELDER, 'messages', 'm1')))
    await seed('full_access')
    await assertSucceeds(getDoc(doc(as(CARETAKER), 'elders', ELDER, 'messages', 'm1')))
    await assertFails(getDoc(doc(as(STRANGER), 'elders', ELDER, 'messages', 'm1')))
  })
})

describe('actions and approvals', () => {
  beforeEach(() => seed('alerts_only'))

  it('elder and caretaker (any tier) read actions; others cannot', async () => {
    await assertSucceeds(getDoc(doc(as(ELDER), 'elders', ELDER, 'actions', 'a1')))
    await assertSucceeds(getDoc(doc(as(CARETAKER), 'elders', ELDER, 'actions', 'a1')))
    await assertFails(getDoc(doc(as(STRANGER), 'elders', ELDER, 'actions', 'a1')))
  })

  it('nobody approves or edits actions from the client', async () => {
    await assertFails(updateDoc(doc(as(CARETAKER), 'elders', ELDER, 'actions', 'a1'), { status: 'done' }))
    await assertFails(updateDoc(doc(as(ELDER), 'elders', ELDER, 'actions', 'a1'), { status: 'cancelled' }))
  })
})

describe('autonomy rules and volunteers', () => {
  beforeEach(() => seed())

  it('caretaker can update rules with valid values', async () => {
    const next = { ...validRules, tools: { ...validRules.tools, order_food: { mode: 'caretaker_approve', limitMinor: 0 } } }
    await assertSucceeds(setDoc(doc(as(CARETAKER), 'rules', ELDER), next))
    const blocked = { ...validRules, tools: { ...validRules.tools, book_ride: { mode: 'blocked', limitMinor: 0 } } }
    await assertSucceeds(setDoc(doc(as(CARETAKER), 'rules', ELDER), blocked))
  })

  it('rejects float limits, bad modes, unknown tools and elder edits', async () => {
    const withTool = (tool: object) => ({ ...validRules, tools: { ...validRules.tools, ...tool } })
    await assertFails(setDoc(doc(as(CARETAKER), 'rules', ELDER), withTool({ order_food: { mode: 'autonomous', limitMinor: 500.5 } })))
    await assertFails(setDoc(doc(as(CARETAKER), 'rules', ELDER), withTool({ order_food: { mode: 'yolo', limitMinor: 1 } })))
    await assertFails(setDoc(doc(as(CARETAKER), 'rules', ELDER), withTool({ escalate_emergency: { mode: 'caretaker_approve' } })))
    await assertFails(setDoc(doc(as(ELDER), 'rules', ELDER), validRules))
    await assertFails(setDoc(doc(as(STRANGER), 'rules', ELDER), validRules))
  })

  it('caretaker adds volunteers only for their elder, stamped as themselves', async () => {
    const vol = { elderId: ELDER, name: 'Asha', phone: '+91 1', skills: ['shopping'], trusted: true, addedBy: CARETAKER }
    await assertSucceeds(setDoc(doc(as(CARETAKER), 'volunteers', 'v1'), vol))
    await assertFails(setDoc(doc(as(CARETAKER), 'volunteers', 'v2'), { ...vol, addedBy: STRANGER }))
    await assertFails(setDoc(doc(as(STRANGER), 'volunteers', 'v3'), { ...vol, addedBy: STRANGER }))
    await assertFails(getDoc(doc(as(ELDER), 'volunteers', 'v1')))
  })
})
