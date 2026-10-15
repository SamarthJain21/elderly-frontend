/**
 * Firebase Auth for live mode. Only the Auth module is imported (no Firestore — the backend owns all data).
 * The web config below is the project's PUBLIC config (served at https://elderly-3e18c.web.app/__/firebase/init.json);
 * it identifies the project, it is not a secret. Override with VITE_FIREBASE_* in .env if needed.
 */
import { initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, type User,
} from 'firebase/auth'

const env = import.meta.env
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyBsxCOazvOyfF-BeOP_G_yM8M9_9ogBRwU',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'elderly-3e18c.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'elderly-3e18c',
  appId: env.VITE_FIREBASE_APP_ID || '1:968215624615:web:63ea777fd96fc9e2d2d482',
})
export const auth = getAuth(app)

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
