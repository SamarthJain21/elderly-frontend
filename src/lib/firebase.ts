/**
 * Firebase Auth for live mode. Only the Auth module is imported (no Firestore — the backend owns all data).
 * The web config below is the project's PUBLIC config (served at https://elderly-3e18c.web.app/__/firebase/init.json);
 * it identifies the project, it is not a secret. Override with VITE_FIREBASE_* in .env if needed.
 */
import { initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider, browserPopupRedirectResolver, getAuth, inMemoryPersistence, initializeAuth, onAuthStateChanged,
  signInWithEmailAndPassword, signInWithPopup, signOut, type User,
} from 'firebase/auth'
import { SANDBOX_FRAME } from '../data/mode'

const env = import.meta.env
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyBsxCOazvOyfF-BeOP_G_yM8M9_9ogBRwU',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'elderly-3e18c.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'elderly-3e18c',
  appId: env.VITE_FIREBASE_APP_ID || '1:968215624615:web:63ea777fd96fc9e2d2d482',
})
// A 'Try with real AI' frame (/try) keeps its sign-in in memory only: the elder and family frames on that page each
// have their own account, and neither touches the visitor's real sign-in in other tabs.
export const auth = SANDBOX_FRAME
  ? initializeAuth(app, { persistence: inMemoryPersistence, popupRedirectResolver: browserPopupRedirectResolver })
  : getAuth(app)

/** Sandbox frames sign in from the link's #e=…&p=… (a throwaway account; the fragment never reaches a server). */
let sandboxSigningIn = false
export const isSandboxSigningIn = () => sandboxSigningIn
export const sandboxSignIn: Promise<void> | null = SANDBOX_FRAME ? (() => {
  const h = new URLSearchParams(location.hash.slice(1))
  const email = h.get('e'), pw = h.get('p')
  history.replaceState(history.state, '', location.pathname + location.search)  // don't leave it in the address
  if (!email || !pw) return Promise.reject(new Error('This sandbox link is missing its sign-in — start again from /try'))
  sandboxSigningIn = true
  return signInWithEmailAndPassword(auth, email, pw).then(() => undefined).finally(() => { sandboxSigningIn = false })
})() : null

/** Caretakers must use Google (the backend rejects caretaker password logins). */
export const signInCaretaker = () => signInWithPopup(auth, new GoogleAuthProvider())
/** Elders sign in with the account the caretaker created (POST /elders → email + one-time password). */
export const signInElder = (email: string, password: string) => signInWithEmailAndPassword(auth, email, password)
export const signOutUser = () => signOut(auth)
export const onUser = (cb: (u: User | null) => void) => onAuthStateChanged(auth, cb)
/** Fresh ID token for the backend's `Authorization: Bearer` header and the WebSocket `auth` frame. */
export const getToken = async () => {
  if (!auth.currentUser) throw new Error('Not signed in')
  return auth.currentUser.getIdToken()
}
