/**
 * Speech-to-text via the browser's Web Speech API (best in Chrome/Edge/Safari). Read-aloud uses Google's natural
 * voices (Cloud Text-to-Speech, via the backend) when signed in, else the device's own voices.
 */
import type { Language } from './types'

type SR = { lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number; start(): void; stop(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null }

const SRCtor: (new () => SR) | undefined =
  typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : undefined

export const canListen = () => !!SRCtor
export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window

// ---------------- listening ----------------

let active: SR | null = null

/** Browser speech locale: Hinglish is spoken Hindi (the hi-IN recognizer and voices handle the mix). */
export const speechLocale = (lang: Language): string => lang === 'hi-Latn' ? 'hi-IN' : lang

/** Older people often pause mid-sentence: keep listening until this much silence after they last spoke. */
export const SILENCE_MS = 2000
const MAX_LISTEN_MS = 30_000

export function listen(lang: Language, onText: (t: string) => void, onEnd: (err?: string) => void): () => void {
  if (!SRCtor) { onEnd('unsupported'); return () => {} }
  const r = new SRCtor()
  // Continuous: the browser's default stops at the first short pause and cuts people off.
  r.lang = speechLocale(lang); r.interimResults = true; r.continuous = true; r.maxAlternatives = 1
  let finals: string[] = []
  let interim = ''
  let silence: ReturnType<typeof setTimeout> | undefined
  const cap = setTimeout(() => { try { r.stop() } catch { /* already stopped */ } }, MAX_LISTEN_MS)
  // onerror and onend both fire on errors — report the end exactly once.
  let ended = false
  const finish = (err?: string) => {
    if (ended) return
    ended = true
    if (active === r) active = null  // a late end from an OLD recognizer must not clear the current one
    clearTimeout(silence); clearTimeout(cap)
    const said = [...finals, interim].join(' ').replace(/\s+/g, ' ').trim()
    const echo = !!said && isEcho(said)  // the mic heard the helper's own voice: don't send it back (that loops)
    if (said && !echo) onText(said)
    onEnd(said && !echo ? undefined : echo ? 'echo' : err)
    const after = afterListening; afterListening = null
    after?.()  // a reply that arrived while they were speaking is read now
  }
  r.onresult = e => {
    // Rebuild from the whole list every time (Android repeats earlier phrases in later events, which piled up).
    const all = Array.from({ length: e.results.length }, (_, i) => e.results[i])
    finals = collapseRepeats(all.filter(x => x.isFinal).map(x => x[0].transcript.trim()))
    interim = all.filter(x => !x.isFinal).map(x => x[0].transcript).join(' ')
    clearTimeout(silence)
    silence = setTimeout(() => { try { r.stop() } catch { /* already stopped */ } }, SILENCE_MS)
  }
  r.onerror = e => finish(e.error)
  r.onend = () => finish()
  try { active?.stop() } catch { /* previous already stopped */ }
  stopSpeaking()  // never listen while the helper is talking — the mic would hear it
  try { r.start(); active = r } catch { finish('start-failed') }
  return () => { try { r.stop() } catch { /* already stopped */ } }
}

/**
 * Android Chrome sends growing versions of the same phrase as separate finals ("hello", "hello how",
 * "hello how are you"). Keep the longest of each run; keep genuinely separate phrases.
 */
export function collapseRepeats(phrases: string[]): string[] {
  const out: string[] = []
  const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').trim()
  for (const p of phrases.filter(Boolean)) {
    const last = out[out.length - 1]
    if (last !== undefined && norm(p).startsWith(norm(last))) out[out.length - 1] = p      // grew: replace
    else if (last !== undefined && norm(last).startsWith(norm(p))) continue               // shrank/repeat: skip
    else out.push(p)
  }
  return out
}

// What the helper said recently, to recognise its own voice coming back through the mic.
let lastSpoken: { text: string; at: number } | null = null
export function isEcho(heard: string, now = Date.now()): boolean {
  if (!lastSpoken || now - lastSpoken.at > 30_000) return false
  const n = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean)
  const h = n(heard), said = new Set(n(lastSpoken.text))
  if (h.length < 3) return false
  return h.filter(w => said.has(w)).length / h.length >= 0.8  // nearly every word was in what the helper just said
}
let afterListening: (() => void) | null = null
const listeningNow = () => active !== null

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

// ---------- loudness & speed (the elder app's settings, also set by family) ----------
let playback = { volume: 1, rate: 1 }
export function setPlayback(p: { volume: number; rate: number }) { playback = p; if (audio) { audio.volume = p.volume; audio.playbackRate = p.rate } }
function tune(a: HTMLAudioElement) { a.volume = playback.volume; a.playbackRate = playback.rate; return a }

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
    audio = tune(new Audio(url))
    audio.play().catch(fallback)  // e.g. autoplay blocked before the first tap
  }
  const key = `${lang}|${clean}`
  const hit = clips.get(key)
  if (hit) { clips.delete(key); clips.set(key, hit); play(hit); return }
  fetchClip(clean, lang).then(blob => { const url = URL.createObjectURL(blob); remember(key, url); play(url) }, fallback)
}

// ---------- before the first tap ----------
// Browsers block sound until the person has touched the page once. An elder who opens the setup link is signed in
// without touching anything, so the first things the helper says would be silently dropped: hold the latest one
// and say it on the first tap instead.
let held: (() => void) | null = null
const listeners = new Set<(blocked: boolean) => void>()
export const soundBlocked = () => typeof navigator !== 'undefined' && !!navigator.userActivation && !navigator.userActivation.hasBeenActive
/** For the "Tap anywhere to hear me" hint. */
export function onSoundBlockedChange(fn: (blocked: boolean) => void) { listeners.add(fn); return () => { listeners.delete(fn) } }
function holdUntilTap(say: () => void) {
  if (!held) {
    const go = () => {
      document.removeEventListener('pointerdown', go, true); document.removeEventListener('keydown', go, true)
      const h = held; held = null
      listeners.forEach(f => f(false))
      h?.()
    }
    document.addEventListener('pointerdown', go, true); document.addEventListener('keydown', go, true)
    listeners.forEach(f => f(true))
  }
  held = say  // only the newest line matters
}

// ---------- pushed voice: the server sends a reply's audio over the chat socket (no round trip) ----------
/** How long a shown reply waits for the server's audio before fetching the voice itself. */
export const PUSH_WAIT_MS = 2500
interface Pushed { clips: (Blob | undefined)[]; last: number | null; next: number; token: number | null; playing: boolean; timer?: number }
const pushed = new Map<string, Pushed>()  // messageId → clips, oldest dropped after a few messages

function entry(id: string): Pushed {
  let p = pushed.get(id)
  if (!p) {
    p = { clips: [], last: null, next: 0, token: null, playing: false }
    pushed.set(id, p)
    if (pushed.size > 8) pushed.delete(pushed.keys().next().value as string)
  }
  return p
}

function playNext(id: string, text: string, lang: Language) {
  const p = pushed.get(id)
  if (!p || p.token !== seq || p.playing) return  // superseded, or a clip is still playing (its end calls us)
  const blob = p.clips[p.next]
  if (!blob) return  // not here yet; addPushedClip calls us again
  clearTimeout(p.timer)
  const url = URL.createObjectURL(blob)
  const a = tune(new Audio(url))
  audio = a; p.playing = true
  a.onended = () => {
    URL.revokeObjectURL(url); p.playing = false; p.next++
    if (audio === a) audio = null
    playNext(id, text, lang)
  }
  a.play().catch(() => { if (p.token === seq && p.next === 0) speakDevice(text, lang, 0.85) })  // autoplay blocked
}

/** A clip of a reply's voice arrived from the server (live.ts, 'audio' frame). Plays if that reply is being read. */
export function addPushedClip(messageId: string, index: number, last: boolean, blob: Blob) {
  const p = entry(messageId)
  p.clips[index] = blob
  if (last) p.last = index
  const ctx = reading.get(messageId)
  if (ctx) playNext(messageId, ctx.text, ctx.lang)
}
const reading = new Map<string, { text: string; lang: Language }>()

/**
 * Read a helper reply aloud using the audio the server pushes for it; if none arrives within PUSH_WAIT_MS (older
 * backend, a failure), fetch the voice the usual way. A newer speak/stop wins, and a late clip is then ignored.
 */
export function speakMessage(messageId: string, text: string, lang: Language) {
  if (soundBlocked()) { holdUntilTap(() => speakMessage(messageId, text, lang)); return }
  if (listeningNow()) { afterListening = () => speakMessage(messageId, text, lang); return }
  lastSpoken = { text, at: Date.now() }
  const my = ++seq
  stopAudio()
  if (canSpeak() && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel()
  const p = entry(messageId)
  p.token = my; p.next = 0; p.playing = false
  reading.clear(); reading.set(messageId, { text, lang })
  p.timer = setTimeout(() => { if (seq === my && !p.clips[0]) speak(text, lang) }, PUSH_WAIT_MS) as unknown as number
  playNext(messageId, text, lang)
}

/**
 * Read text aloud in the elder's language: Google's natural voice when available, else the device voice (slowly,
 * 0.85×). Returns false and stays SILENT when neither can speak that language — an English voice reading Thai or
 * Hindi is worse than silence.
 */
export function speak(text: string, lang: Language = 'en-US', rate = 0.85): boolean {
  const clean = text.replace(/<[^>]+>/g, '').replace(/\p{Extended_Pictographic}/gu, '').trim()
  if (!clean) return false
  if (soundBlocked()) { holdUntilTap(() => speak(text, lang, rate)); return true }
  if (listeningNow()) { afterListening = () => speak(text, lang, rate); return true }
  lastSpoken = { text: clean, at: Date.now() }
  if (cloud && typeof Audio !== 'undefined') { speakCloud(cloud, clean, lang, rate); return true }
  return speakDevice(clean, lang, rate)
}

function speakDevice(clean: string, lang: Language, rate: number): boolean {
  if (!canSpeak()) return false
  const voices = voicesFor(lang)
  const voice = voices.find(v => v.voiceURI === savedVoiceURI(lang)) ?? voices[0]
  if (!voice) return false
  const u = new SpeechSynthesisUtterance(clean)
  u.lang = speechLocale(lang); u.rate = rate * playback.rate; u.volume = playback.volume; u.voice = voice
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

export const stopSpeaking = () => { seq++; held = null; stopAudio(); if (canSpeak()) { current = null; speechSynthesis.cancel() } }
