// Web Speech API: speech-to-text (Chrome/Edge/Safari) and text-to-speech (all modern browsers).
import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal typings — TypeScript's DOM lib doesn't ship SpeechRecognition.
interface RecognitionAlternative { transcript: string }
interface RecognitionResult { isFinal: boolean; 0: RecognitionAlternative; length: number }
interface RecognitionEvent extends Event { resultIndex: number; results: { length: number; [i: number]: RecognitionResult } }
interface RecognitionErrorEvent extends Event { error: string }
interface Recognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}
type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const canListen = typeof window !== 'undefined' && recognitionCtor() !== null
export const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

const SILENCE_MS = 3000

/**
 * Tap to start, then it auto-finishes after 3s of silence (or tap again).
 * `onFinal` gets the full transcript once, when listening ends with something said.
 */
export function useListen(lang: string, onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<Recognition | null>(null)
  const textRef = useRef('')
  const silenceRef = useRef<number | undefined>(undefined)
  const onFinalRef = useRef(onFinal)
  useEffect(() => { onFinalRef.current = onFinal }, [onFinal])

  const stop = useCallback(() => {
    window.clearTimeout(silenceRef.current)
    recRef.current?.stop() // fires onend, which delivers the transcript
  }, [])

  const start = useCallback(() => {
    const Ctor = recognitionCtor()
    if (Ctor === null || recRef.current !== null) return
    if (canSpeak) window.speechSynthesis.cancel() // don't transcribe our own voice
    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true
    textRef.current = ''
    setInterim('')
    setError(null)

    const armSilence = () => {
      window.clearTimeout(silenceRef.current)
      silenceRef.current = window.setTimeout(() => rec.stop(), SILENCE_MS)
    }

    rec.onresult = (e) => {
      let finalText = ''
      let pending = ''
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else pending += r[0].transcript
      }
      textRef.current = finalText
      setInterim((finalText + pending).trim())
      armSilence()
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setError('Please allow the microphone to talk.')
      else if (e.error !== 'no-speech' && e.error !== 'aborted') setError("Sorry, I couldn't hear that.")
    }
    rec.onend = () => {
      window.clearTimeout(silenceRef.current)
      recRef.current = null
      setListening(false)
      setInterim('')
      const said = textRef.current.trim()
      if (said !== '') onFinalRef.current(said)
    }

    recRef.current = rec
    rec.start()
    setListening(true)
    armSilence() // also ends if they never start speaking
  }, [lang])

  useEffect(() => () => {
    window.clearTimeout(silenceRef.current)
    recRef.current?.abort()
  }, [])

  return { listening, interim, error, start, stop }
}

// macOS ships joke/character voices under en-US; never use them for an elder companion.
const NOVELTY = /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|junior|kathy|organ|pipe organ|princess|ralph|superstar|trinoids|whisper|wobble|zarvox|fred|grandma|grandpa|rocko|shelley|sandy|eddy|flo|reed/i
// Natural-sounding voices, best first. Google voices are Chrome's network voices.
const PREFERRED = [/^google/i, /natural|neural|premium|enhanced/i, /samantha|ava|allison|susan|zoe|karen|moira|tessa|serena|daniel/i, /lekha|kanya|narisa/i, /microsoft (aria|jenny|guy|swara|madhur|premwadee|niwat)/i]

function score(v: SpeechSynthesisVoice): number {
  if (NOVELTY.test(v.name)) return -1
  const i = PREFERRED.findIndex((re) => re.test(v.name))
  return i === -1 ? 1 : 100 - i * 10
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const base = lang.split('-')[0].toLowerCase()
  const norm = (v: SpeechSynthesisVoice) => v.lang.replace('_', '-').toLowerCase()
  const candidates = window.speechSynthesis.getVoices()
    .filter((v) => norm(v) === lang.toLowerCase() || norm(v).startsWith(`${base}-`) || norm(v) === base)
    .filter((v) => score(v) >= 0)
  // Exact locale beats same language (en-US over en-GB), then by quality.
  return candidates.sort((a, b) =>
    Number(norm(b) === lang.toLowerCase()) - Number(norm(a) === lang.toLowerCase()) || score(b) - score(a),
  )[0]
}

/**
 * Read text aloud slowly (0.85x per spec) in the elder's language.
 * Returns false (and stays silent) if the device has no voice for that language —
 * an English voice reading Thai or Hindi is worse than silence.
 */
// Chrome garbage-collects in-flight utterances (speech stops or never starts) unless referenced.
let current: SpeechSynthesisUtterance | null = null

export function speak(text: string, lang: string): boolean {
  if (!canSpeak) return false
  const voice = pickVoice(lang)
  if (voice === undefined) return false
  const synth = window.speechSynthesis
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  u.rate = 0.85
  u.voice = voice
  u.onend = () => { if (current === u) current = null }
  current = u
  const go = () => {
    synth.resume() // Chrome can get stuck "paused" after a cancel
    synth.speak(u)
  }
  // Chrome drops a speak() issued in the same tick as cancel(); only cancel when needed, then wait.
  if (synth.speaking || synth.pending) {
    synth.cancel()
    window.setTimeout(go, 80)
  } else {
    go()
  }
  return true
}

/** Voices load asynchronously in Chrome; resolves true once a voice for `lang` is available. */
export function useHasVoice(lang: string): boolean {
  const [has, setHas] = useState(() => canSpeak && pickVoice(lang) !== undefined)
  useEffect(() => {
    if (!canSpeak) return
    const check = () => setHas(pickVoice(lang) !== undefined)
    window.speechSynthesis.addEventListener('voiceschanged', check)
    // Voices may have loaded between first render and now, in which case no event will come.
    const id = window.setTimeout(check, 0)
    return () => {
      window.clearTimeout(id)
      window.speechSynthesis.removeEventListener('voiceschanged', check)
    }
  }, [lang])
  return has
}

export function stopSpeaking(): void {
  if (!canSpeak) return
  current = null
  window.speechSynthesis.cancel()
}
