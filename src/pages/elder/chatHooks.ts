import { useEffect, useRef, useState } from 'react'
import { speak, stopSpeaking, useVoices } from '../../lib/speech'

const VOICE_KEY = 'elderly.voice'
function readVoicePref(): boolean {
  try { return localStorage.getItem(VOICE_KEY) !== 'off' } catch { return true }
}
function writeVoicePref(on: boolean): void {
  try { localStorage.setItem(VOICE_KEY, on ? 'on' : 'off') } catch { /* private mode: keep in memory only */ }
}

/** Voice on/off (shared across both screens) + whether this device can speak the language. */
export function useVoice(lang: string) {
  const voices = useVoices(lang)
  const [on, setOn] = useState(readVoicePref)
  const toggle = () => {
    const next = !on
    setOn(next)
    writeVoicePref(next)
    if (!next) stopSpeaking()
  }
  return { voices, hasVoice: voices.length > 0, on, toggle }
}

/**
 * Speak `text` of the newest item when it changes — but not for the history present on first load.
 * `ready` = history has loaded.
 */
export function useSpeakNewest(id: string | null, text: string | null, ready: boolean, enabled: boolean, lang: string) {
  const spokenRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    if (spokenRef.current === undefined) {
      if (ready) spokenRef.current = id
      return
    }
    if (id === null || id === spokenRef.current) return
    spokenRef.current = id
    if (enabled && text !== null) speak(text, lang)
  }, [id, text, ready, enabled, lang])
  useEffect(() => stopSpeaking, [])
}

// Unread tracking for family messages — per device (elders typically use one phone/tablet).
const SEEN_KEY = (elderId: string) => `elderly.familySeen.${elderId}`
export function familySeenAt(elderId: string): string {
  try { return localStorage.getItem(SEEN_KEY(elderId)) ?? '' } catch { return '' }
}
export function markFamilySeen(elderId: string, iso: string): void {
  try { localStorage.setItem(SEEN_KEY(elderId), iso) } catch { /* not remembered */ }
}
