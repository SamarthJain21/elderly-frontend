/**
 * Speech-to-text and text-to-speech. Prototype uses the browser's Web Speech API (best in Chrome/Edge).
 * Production plan: swap for a server-side STT/TTS provider behind the same two functions.
 */
import type { Language } from './types'

type SR = { lang: string; interimResults: boolean; maxAlternatives: number; start(): void; stop(): void
  onresult: ((e: { results: { 0: { transcript: string } }[] }) => void) | null
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null }

const SRCtor: (new () => SR) | undefined =
  typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : undefined

export const canListen = () => !!SRCtor
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

let active: SR | null = null

export function listen(lang: Language, onText: (t: string) => void, onEnd: (err?: string) => void): () => void {
  if (!SRCtor) { onEnd('unsupported'); return () => {} }
  const r = new SRCtor()
  r.lang = lang; r.interimResults = false; r.maxAlternatives = 1
  r.onresult = e => onText(e.results[0][0].transcript)
  r.onerror = e => onEnd(e.error)
  r.onend = () => { active = null; onEnd() }
  try { r.start(); active = r } catch { onEnd('start-failed') }
  return () => { try { r.stop() } catch { /* already stopped */ } }
}

export const stopListening = () => { try { active?.stop() } catch { /* noop */ } }

export function speak(text: string, lang: Language = 'en-US', rate = 0.92) {
  if (!canSpeak()) return
  const clean = text.replace(/<[^>]+>/g, '').replace(/\p{Extended_Pictographic}/gu, '').trim()
  if (!clean) return
  try {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(clean)
    u.lang = lang; u.rate = rate
    speechSynthesis.speak(u)
  } catch { /* speech is a nicety */ }
}

export const stopSpeaking = () => { if (canSpeak()) speechSynthesis.cancel() }
