/**
 * Speech-to-text via the browser's Web Speech API (best in Chrome/Edge/Safari). Read-aloud uses Google's natural
 * voices (Cloud Text-to-Speech, via the backend) when signed in, else the device's own voices.
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

/** Browser speech locale: Hinglish is spoken Hindi (the hi-IN recognizer and voices handle the mix). */
export const speechLocale = (lang: Language): string => lang === 'hi-Latn' ? 'hi-IN' : lang

export function listen(lang: Language, onText: (t: string) => void, onEnd: (err?: string) => void): () => void {
  if (!SRCtor) { onEnd('unsupported'); return () => {} }
  const r = new SRCtor()
  r.lang = speechLocale(lang); r.interimResults = false; r.maxAlternatives = 1
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

// ---------- natural voice (live mode) ----------
/** Fetches an MP3 of `text` (POST /tts). Registered by data/live.ts; demo mode has none and uses the device voice. */
export type CloudVoice = (text: string, lang: Language) => Promise<Blob>
let cloud: CloudVoice | null = null
export const setCloudVoice = (fn: CloudVoice | null) => { cloud = fn }

const CLIPS_KEPT = 30          // replays ("Listen to this message") don't fetch again
const clips = new Map<string, string>()  // `${lang}|${text}` → object URL
let audio: HTMLAudioElement | null = null
let seq = 0                    // a newer speak()/stopSpeaking() wins over a clip still loading

function remember(key: string, url: string) {
  clips.set(key, url)
  if (clips.size > CLIPS_KEPT) {
    const [oldest, old] = clips.entries().next().value as [string, string]
    clips.delete(oldest); URL.revokeObjectURL(old)
  }
}

function stopAudio() { if (audio) { audio.pause(); audio = null } }

function speakCloud(fetchClip: CloudVoice, clean: string, lang: Language, rate: number) {
  const my = ++seq
  stopAudio()
  if (canSpeak() && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel()
  const fallback = () => { if (my === seq) speakDevice(clean, lang, rate) }
  const play = (url: string) => {
    if (my !== seq) return
    audio = new Audio(url)
    audio.play().catch(fallback)  // e.g. autoplay blocked before the first tap
  }
  const key = `${lang}|${clean}`
  const hit = clips.get(key)
  if (hit) { clips.delete(key); clips.set(key, hit); play(hit); return }
  fetchClip(clean, lang).then(blob => { const url = URL.createObjectURL(blob); remember(key, url); play(url) }, fallback)
}

/**
 * Read text aloud in the elder's language: Google's natural voice when available, else the device voice (slowly,
 * 0.85×). Returns false and stays SILENT when neither can speak that language — an English voice reading Thai or
 * Hindi is worse than silence.
 */
export function speak(text: string, lang: Language = 'en-US', rate = 0.85): boolean {
  const clean = text.replace(/<[^>]+>/g, '').replace(/\p{Extended_Pictographic}/gu, '').trim()
  if (!clean) return false
  if (cloud && typeof Audio !== 'undefined') { speakCloud(cloud, clean, lang, rate); return true }
  return speakDevice(clean, lang, rate)
}

function speakDevice(clean: string, lang: Language, rate: number): boolean {
  if (!canSpeak()) return false
  const voices = voicesFor(lang)
  const voice = voices.find(v => v.voiceURI === savedVoiceURI(lang)) ?? voices[0]
  if (!voice) return false
  const u = new SpeechSynthesisUtterance(clean)
  u.lang = speechLocale(lang); u.rate = rate; u.voice = voice
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

export const stopSpeaking = () => { seq++; stopAudio(); if (canSpeak()) { current = null; speechSynthesis.cancel() } }
