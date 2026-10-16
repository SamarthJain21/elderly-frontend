import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { firebaseApp } from './firebase'

/**
 * Notifications on the family's phone: SOS, a worrying check-in, an approval waiting, a message from the elder.
 * 'unsupported' covers iPhone Safari outside an installed home-screen app, private windows, and frames.
 */
export type PushState = 'unsupported' | 'off' | 'on' | 'blocked'

export async function pushState(): Promise<PushState> {
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator) || window.self !== window.top) return 'unsupported'
  if (!(await isSupported().catch(() => false))) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  return Notification.permission === 'granted' && localStorage.getItem('elderly.push') === 'on' ? 'on' : 'off'
}

/** Ask permission (from a tap), register this device, and give the backend its token. */
export async function enablePush(save: (token: string) => Promise<unknown>): Promise<PushState> {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return perm === 'denied' ? 'blocked' : 'off'
  const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
  const token = await getToken(getMessaging(firebaseApp), { serviceWorkerRegistration: reg })
  await save(token)
  try { localStorage.setItem('elderly.push', 'on') } catch { /* fine */ }
  return 'on'
}
