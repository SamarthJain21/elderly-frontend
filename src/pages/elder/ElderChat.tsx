import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert, Box, Button, ButtonBase, InputBase, Menu, MenuItem, Typography } from '@mui/material'
import { useAuth } from '../../auth/AuthContext'
import { useChat } from '../../lib/useChat'
import type { ChatMessage, ElderProfile, Mood } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { canListen, saveVoiceURI, savedVoiceURI, speak, stopSpeaking, useListen, useVoices } from '../../lib/speech'
import { Pill } from '../../components/ui'
import { ActionCardView } from '../../components/ActionCardView'
import { tokens } from '../../theme'

// Mirrors the prototype's .msg / .msg.me / .msg.agent bubbles.
function Bubble({ m, onAnswer, disabled }: { m: ChatMessage; onAnswer?: (id: string, approve: boolean) => void; disabled?: boolean }) {
  const mine = m.sender === 'elder'
  return (
    <Box sx={{
      fontSize: 21, lineHeight: 1.35, px: '18px', py: '14px', borderRadius: '24px', maxWidth: '92%', my: 1.5,
      width: 'fit-content', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
      ...(mine
        ? { bgcolor: tokens.ink, color: tokens.white, ml: 'auto', borderBottomRightRadius: '8px' }
        : { bgcolor: tokens.accentSoft, color: tokens.ink, borderBottomLeftRadius: '8px' }),
    }}>
      {!mine && (
        <Box component="span" sx={{ display: 'block', fontSize: 13, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.65, mb: 0.5 }}>
          Elderly
        </Box>
      )}
      {m.text}
      {m.action !== null && m.action !== undefined && (
        <ActionCardView card={m.action} disabled={disabled}
          onAnswer={onAnswer && m.action ? (approve) => onAnswer(m.action!.id, approve) : undefined} />
      )}
    </Box>
  )
}

function Typing() {
  return (
    <Box aria-label="Elderly is typing" sx={{ bgcolor: tokens.accentSoft, borderRadius: '24px', borderBottomLeftRadius: '8px', px: 2.5, py: 2, width: 'fit-content', my: 1.5, display: 'flex', gap: 0.75 }}>
      {[0, 1, 2].map((i) => (
        <Box key={i} sx={{
          width: 9, height: 9, borderRadius: '50%', bgcolor: tokens.accent,
          animation: 'blink 1.2s infinite', animationDelay: `${i * 0.2}s`,
          '@keyframes blink': { '0%, 80%, 100%': { opacity: 0.25 }, '40%': { opacity: 1 } },
        }} />
      ))}
    </Box>
  )
}

const STARTERS = ['Good morning! 👋', 'I feel a bit lonely', 'What should I eat today?']

const VOICE_KEY = 'elderly.voice'
function readVoicePref(): boolean {
  try { return localStorage.getItem(VOICE_KEY) !== 'off' } catch { return true }
}
function writeVoicePref(on: boolean): void {
  try { localStorage.setItem(VOICE_KEY, on ? 'on' : 'off') } catch { /* private mode: keep in memory only */ }
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}

export function ElderChat() {
  const { state } = useAuth()
  const elderId = state.status === 'ready' ? state.me.uid : null
  const { messages, status, typing, error, checkin, send, startCheckIn, confirm } = useChat(elderId)
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const profile = useApi<ElderProfile>(elderId && `/elders/${elderId}`)
  const lang = profile.data?.language ?? 'en-US'
  const voices = useVoices(lang)
  const hasVoice = voices.length > 0
  const [voiceMenu, setVoiceMenu] = useState<HTMLElement | null>(null)
  const [, rerender] = useState(0) // the choice lives in localStorage, keyed by language
  const savedURI = savedVoiceURI(lang)
  const activeVoice = voices.find((v) => v.voiceURI === savedURI) ?? voices[0]
  const chooseVoice = (v: SpeechSynthesisVoice) => {
    saveVoiceURI(lang, v.voiceURI)
    rerender((n) => n + 1)
    setVoiceMenu(null)
    speak(lang.startsWith('hi') ? 'नमस्ते, मैं Elderly हूँ।' : lang.startsWith('th') ? 'สวัสดีค่ะ ฉันชื่อ Elderly' : "Hello, I'm Elderly.", lang)
  }
  const [voiceOn, setVoiceOn] = useState(readVoicePref)
  const [params, setParams] = useSearchParams()
  const checkinParam = params.get('checkin')

  // Arrived from a mood face on the home screen: start today's check-in once the socket is ready.
  useEffect(() => {
    if (checkinParam === null || status !== 'open' || checkin === undefined) return
    const startable = checkin !== null && (checkin.status === 'due' || checkin.status === 'missed')
    if (startable) {
      const mood = (['good', 'okay', 'low'] as const).find((m) => m === checkinParam)
      startCheckIn((mood ?? null) as Mood | null)
    }
    setParams({}, { replace: true }) // consume, so a refresh doesn't restart it
  }, [checkinParam, status, checkin, startCheckIn, setParams])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, typing])

  const last = messages.at(-1)
  const suggestions = typing ? [] : last === undefined ? STARTERS : last.sender === 'agent' ? last.quickReplies : []
  const canSend = status === 'open' && !typing

  const submit = useCallback((value: string) => {
    stopSpeaking()
    if (canSend && send(value)) setText('')
  }, [canSend, send])

  // Spoken words go straight out; if we can't send right now, leave them in the box.
  const onHeard = useCallback((said: string) => {
    if (canSend && send(said)) return
    setText(said)
  }, [canSend, send])
  const mic = useListen(lang, onHeard)

  // Arrived from the big mic on the home screen: start listening right away.
  const listenParam = params.get('listen')
  useEffect(() => {
    if (listenParam === null || status !== 'open') return
    if (canListen && canSend) mic.start()
    setParams({}, { replace: true })
  }, [listenParam, status, canSend, mic, setParams])

  // Read new agent replies aloud — but not the history loaded on connect.
  const spokenRef = useRef<string | null | undefined>(undefined)
  useEffect(() => {
    const lastId = messages.at(-1)?.id ?? null
    if (spokenRef.current === undefined) {
      if (status === 'open') spokenRef.current = lastId
      return
    }
    const last = messages.at(-1)
    if (last === undefined || last.id === spokenRef.current) return
    spokenRef.current = last.id
    if (last.sender === 'agent' && voiceOn && hasVoice) speak(last.text, lang)
  }, [messages, status, voiceOn, hasVoice, lang])

  useEffect(() => stopSpeaking, [])

  const toggleVoice = () => {
    const next = !voiceOn
    setVoiceOn(next)
    writeVoicePref(next)
    if (!next) stopSpeaking()
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit(text)
  }

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: 640, mx: 'auto', bgcolor: tokens.paper }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.25, borderBottom: `1px solid ${tokens.line}`, flex: 'none' }}>
        <Button component={Link} to="/elder" sx={{ fontSize: 20, color: tokens.ink, px: 0.5 }}>‹ Back</Button>
        <Typography sx={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 650 }}>Elderly</Typography>
        <Box sx={{ minWidth: 64, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1 }}>
          {checkin?.status === 'in_progress' && <Pill tone="warn">Check-in</Pill>}
          {voices.length > 1 && (
            <ButtonBase onClick={(e) => setVoiceMenu(e.currentTarget)} aria-label="Choose voice" aria-haspopup="menu"
              sx={{ border: `1px solid ${tokens.line}`, bgcolor: tokens.white, borderRadius: '12px', width: 46, height: 46, fontSize: 20 }}>
              🗣️
            </ButtonBase>
          )}
          <Menu anchorEl={voiceMenu} open={voiceMenu !== null} onClose={() => setVoiceMenu(null)}
            slotProps={{ paper: { sx: { maxHeight: 360 } } }}>
            {voices.map((v) => (
              <MenuItem key={v.voiceURI} selected={v.voiceURI === activeVoice?.voiceURI} onClick={() => chooseVoice(v)} sx={{ fontSize: 17 }}>
                {v.name}
                <Box component="span" sx={{ ml: 1, color: tokens.muted, fontSize: 13 }}>{v.lang}</Box>
              </MenuItem>
            ))}
          </Menu>
          {hasVoice && (
            <ButtonBase onClick={toggleVoice} aria-label={voiceOn ? 'Turn voice off' : 'Turn voice on'} aria-pressed={voiceOn}
              sx={{ border: `1px solid ${tokens.line}`, bgcolor: tokens.white, borderRadius: '12px', width: 46, height: 46, fontSize: 20 }}>
              {voiceOn ? '🔊' : '🔇'}
            </ButtonBase>
          )}
        </Box>
      </Box>

      {status === 'reconnecting' && <Alert severity="warning" sx={{ borderRadius: 0 }}>Connecting again…</Alert>}
      {status === 'denied' && <Alert severity="error" sx={{ borderRadius: 0 }}>Please sign in again.</Alert>}

      <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 1 }} aria-live="polite">
        {status === 'connecting' && messages.length === 0 && (
          <Typography sx={{ color: tokens.muted, fontSize: 18, mt: 2 }}>Connecting…</Typography>
        )}
        {status === 'open' && messages.length === 0 && (
          <Typography sx={{ fontSize: 21, color: tokens.ink2, mt: 2 }}>
            Hello! I'm here whenever you want to talk. Type below or tap one of these.
          </Typography>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} m={m} disabled={!canSend} onAnswer={(id, approve) => { stopSpeaking(); confirm(id, approve) }} />
        ))}
        {typing && <Typing />}
        {mic.listening && (
          <Box sx={{ fontSize: 21, lineHeight: 1.35, px: '18px', py: '14px', borderRadius: '24px', borderBottomRightRadius: '8px', maxWidth: '92%', my: 1.5, ml: 'auto', width: 'fit-content', border: `2px dashed ${tokens.line}`, color: tokens.ink2 }}>
            {mic.interim || 'Listening…'}
          </Box>
        )}
        {error !== null && <Alert severity="warning" sx={{ my: 1.5, fontSize: 17 }}>{error}</Alert>}
        {mic.error !== null && <Alert severity="warning" sx={{ my: 1.5, fontSize: 17 }}>{mic.error}</Alert>}

        {suggestions.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1, mb: 1 }}>
            {suggestions.map((q) => (
              <ButtonBase key={q} disabled={!canSend} onClick={() => submit(q)} sx={{
                border: `2px solid ${tokens.line}`, bgcolor: tokens.white, borderRadius: 999, px: 2, py: 1.25,
                fontSize: 18, fontWeight: 700, '&:hover': { borderColor: tokens.ink2 }, '&.Mui-disabled': { opacity: 0.5 },
              }}>
                {q}
              </ButtonBase>
            ))}
          </Box>
        )}
        <div ref={endRef} />
      </Box>

      <Box component="form" onSubmit={onSubmit} sx={{ display: 'flex', gap: 1, p: 1.5, borderTop: `1px solid ${tokens.line}`, flex: 'none', bgcolor: tokens.paper, alignItems: 'center' }}>
        {canListen && (
          <ButtonBase
            onClick={mic.listening ? mic.stop : mic.start}
            disabled={!canSend && !mic.listening}
            aria-label={mic.listening ? 'Stop and send' : 'Speak'}
            sx={{
              width: 58, height: 58, borderRadius: '50%', flex: 'none', color: tokens.white,
              bgcolor: mic.listening ? tokens.sos : tokens.accent,
              animation: mic.listening ? 'micPulse 1.4s infinite' : 'none',
              '@keyframes micPulse': {
                '0%': { boxShadow: '0 0 0 0 rgba(194,54,43,.45)' },
                '70%': { boxShadow: '0 0 0 18px rgba(194,54,43,0)' },
                '100%': { boxShadow: '0 0 0 0 rgba(194,54,43,0)' },
              },
              '&.Mui-disabled': { opacity: 0.5 },
            }}
          >
            <MicIcon />
          </ButtonBase>
        )}
        <InputBase
          value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…"
          inputProps={{ maxLength: 1000, 'aria-label': 'Message' }}
          sx={{ flex: 1, fontSize: 20, px: 2, py: 1, border: `2px solid ${tokens.line}`, borderRadius: '18px', bgcolor: tokens.white }}
        />
        <Button type="submit" variant="contained" disabled={!canSend || text.trim() === ''} sx={{ fontSize: 19, px: 2.5, borderRadius: '18px' }}>
          Send
        </Button>
      </Box>
    </Box>
  )
}
