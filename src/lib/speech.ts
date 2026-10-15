/**
 * Speech-to-text and text-to-speech via the browser's Web Speech API (best in Chrome/Edge/Safari).
 * Production plan: swap for a server-side STT/TTS provider behind the same functions.
 */
import type { Language } from './types'

type SR = { lang: string; interimResults: boolean; maxAlternatives: number; start(): void; stop(): void
  onresult: ((e: { results: { 0: { transcript: string } }[] }) => void) | null
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null }

const SRCtor: (new () => SR) | undefined =
  typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : undefined

export const canListen = () => !!SRCtor
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

// ---------------- listening ----------------

let active: SR | null = null

export function listen(lang: Language, onText: (t: string) => void, onEnd: (err?: string) => void): () => void {
  if (!SRCtor) { onEnd('unsupported'); return () => {} }
  const r = new SRCtor()
  r.lang = lang; r.interimResults = false; r.maxAlternatives = 1
  // onerror and onend both fire on errors — report the end exactly once.
  let ended = false
  const finish = (err?: string) => {
    if (ended) return
    ended = true
    if (active === r) active = null  // a late end from an OLD recognizer must not clear the current one
    onEnd(err)
  }
  r.onresult = e => onText(e.results[0][0].transcript)
  r.onerror = e => finish(e.error)
  r.onend = () => finish()
  try { active?.stop() } catch { /* previous already stopped */ }
  try { r.start(); active = r } catch { finish('start-failed') }
  return () => { try { r.stop() } catch { /* already stopped */ } }
}

export const stopListening = () => { try { active?.stop() } catch { /* noop */ } }

// ---------------- speaking ----------------

// macOS lists joke/character voices as plain en-US; never use them for an elder companion.
const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|junior|kathy|organ|princess|ralph|superstar|trinoids|whisper|wobble|zarvox|fred|grandma|grandpa|rocko|shelley|sandy|eddy|flo|reed/i
// Natural-sounding voices first. Google voices are Chrome's network voices.
const PREFERRED = [/^google/i, /natural|neural|premium|enhanced/i, /samantha|ava|allison|susan|zoe|karen|moira|tessa|serena|daniel/i,
  /lekha|kanya|narisa/i, /microsoft (aria|jenny|guy|swara|madhur|premwadee|niwat)/i]

const score = (v: SpeechSynthesisVoice) => {
  if (NOVELTY.test(v.name)) return -1
  const i = PREFERRED.findIndex(re => re.test(v.name))
  return i === -1 ? 1 : 100 - i * 10
}

/** Usable voices for `lang`, best first: exact locale beats same language, then quality. */
export function voicesFor(lang: string): SpeechSynthesisVoice[] {
  if (!canSpeak()) return []
  const want = lang.toLowerCase(), base = want.split('-')[0]
  const norm = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase()
  return speechSynthesis.getVoices()
    .filter(v => norm(v) === want || norm(v).startsWith(`${base}-`) || norm(v) === base)
    .filter(v => score(v) >= 0)
    .sort((a, b) => Number(norm(b) === want) - Number(norm(a) === want) || score(b) - score(a))
}

const prefKey = (lang: string) => `elderly.voiceURI.${lang}`
export function savedVoiceURI(lang: string): string | null { try { return localStorage.getItem(prefKey(lang)) } catch { return null } }
export function saveVoiceURI(lang: string, uri: string) { try { localStorage.setItem(prefKey(lang), uri) } catch { /* not remembered */ } }

/** True once this device has a voice for `lang` (Chrome loads voices asynchronously). */
export const hasVoiceFor = (lang: string) => voicesFor(lang).length > 0

// Chrome garbage-collects an in-flight utterance (speech stops or never starts) unless something holds it.
let current: SpeechSynthesisUtterance | null = null

/**
 * Read text aloud, slowly (0.85× per spec), in the elder's language. Returns false and stays SILENT when the device
 * has no voice for that language — an English voice reading Thai or Hindi is worse than silence.
 */
export function speak(text: string, lang: Language = 'en-US', rate = 0.85): boolean {
  if (!canSpeak()) return false
  const clean = text.replace(/<[^>]+>/g, '').replace(/\p{Extended_Pictographic}/gu, '').trim()
  if (!clean) return false
  const voices = voicesFor(lang)
  const voice = voices.find(v => v.voiceURI === savedVoiceURI(lang)) ?? voices[0]
  if (!voice) return false
  const u = new SpeechSynthesisUtterance(clean)
  u.lang = lang; u.rate = rate; u.voice = voice
  u.onend = () => { if (current === u) current = null }
  current = u
  const go = () => {
    try { speechSynthesis.resume(); speechSynthesis.speak(u) } catch { /* speech is a nicety */ }
  }
  // Chrome silently drops speak() issued in the same tick as cancel(): only cancel when needed, then wait a beat.
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    speechSynthesis.cancel()
    window.setTimeout(go, 80)
  } else {
    go()
  }
  return true
}

export const stopSpeaking = () => { if (canSpeak()) { current = null; speechSynthesis.cancel() } }
