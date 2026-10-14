// Shared pieces for the elder's two chat screens (Elderly agent / Family): header with voice
// controls, composer with mic, quick-reply chips, bubbles. Prototype: .e-top, .msg, .chip, .mic.sm.
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { useVoice } from './chatHooks'
import { Link } from 'react-router'
import { Box, Button, ButtonBase, InputBase, Menu, MenuItem, Typography, type SxProps, type Theme } from '@mui/material'
import { canListen, saveVoiceURI, savedVoiceURI, speak, stopSpeaking, useListen } from '../../lib/speech'
import { tokens } from '../../theme'

const iconBtn: SxProps<Theme> = { border: `1px solid ${tokens.line}`, bgcolor: tokens.white, borderRadius: '12px', width: 46, height: 46, fontSize: 20 }

export function ChatHeader({ title, lang, voice, right }: {
  title: string
  lang: string
  voice: ReturnType<typeof useVoice>
  right?: ReactNode
}) {
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  const [, rerender] = useState(0) // the chosen voice lives in localStorage, keyed by language
  const savedURI = savedVoiceURI(lang)
  const active = voice.voices.find((v) => v.voiceURI === savedURI) ?? voice.voices[0]
  const choose = (v: SpeechSynthesisVoice) => {
    saveVoiceURI(lang, v.voiceURI)
    rerender((n) => n + 1)
    setMenu(null)
    speak(lang.startsWith('hi') ? 'नमस्ते, मैं Elderly हूँ।' : lang.startsWith('th') ? 'สวัสดีค่ะ ฉันชื่อ Elderly' : "Hello, I'm Elderly.", lang)
  }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1.25, borderBottom: `1px solid ${tokens.line}`, flex: 'none' }}>
      <Button component={Link} to="/elder" sx={{ fontSize: 20, color: tokens.ink, px: 0.5 }}>‹ Back</Button>
      <Typography sx={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 650 }}>{title}</Typography>
      <Box sx={{ minWidth: 64, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1 }}>
        {right}
        {voice.voices.length > 1 && (
          <ButtonBase onClick={(e) => setMenu(e.currentTarget)} aria-label="Choose voice" aria-haspopup="menu" sx={iconBtn}>🗣️</ButtonBase>
        )}
        <Menu anchorEl={menu} open={menu !== null} onClose={() => setMenu(null)} slotProps={{ paper: { sx: { maxHeight: 360 } } }}>
          {voice.voices.map((v) => (
            <MenuItem key={v.voiceURI} selected={v.voiceURI === active?.voiceURI} onClick={() => choose(v)} sx={{ fontSize: 17 }}>
              {v.name}
              <Box component="span" sx={{ ml: 1, color: tokens.muted, fontSize: 13 }}>{v.lang}</Box>
            </MenuItem>
          ))}
        </Menu>
        {voice.hasVoice && (
          <ButtonBase onClick={voice.toggle} aria-label={voice.on ? 'Turn voice off' : 'Turn voice on'} aria-pressed={voice.on} sx={iconBtn}>
            {voice.on ? '🔊' : '🔇'}
          </ButtonBase>
        )}
      </Box>
    </Box>
  )
}

/** Prototype .msg bubble. `tone` picks the colour for the other side's messages. */
export function Bubble({ mine, label, tone = 'agent', footer, children }: {
  mine: boolean
  label?: string
  tone?: 'agent' | 'family'
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <Box sx={{
      fontSize: 21, lineHeight: 1.35, px: '18px', py: '14px', borderRadius: '24px', maxWidth: '92%', my: 1.5,
      width: 'fit-content', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
      ...(mine
        ? { bgcolor: tokens.ink, color: tokens.white, ml: 'auto', borderBottomRightRadius: '8px' }
        : { bgcolor: tone === 'family' ? tokens.plumSoft : tokens.accentSoft, color: tokens.ink, borderBottomLeftRadius: '8px' }),
    }}>
      {label !== undefined && (
        <Box component="span" sx={{ display: 'block', fontSize: 13, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.65, mb: 0.5 }}>
          {label}
        </Box>
      )}
      {children}
      {footer}
    </Box>
  )
}

export function QuickReplies({ options, disabled, onPick }: { options: string[]; disabled: boolean; onPick: (q: string) => void }) {
  if (options.length === 0) return null
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1, mb: 1 }}>
      {options.map((q) => (
        <ButtonBase key={q} disabled={disabled} onClick={() => onPick(q)} sx={{
          border: `2px solid ${tokens.line}`, bgcolor: tokens.white, borderRadius: 999, px: 2, py: 1.25,
          fontSize: 18, fontWeight: 700, '&:hover': { borderColor: tokens.ink2 }, '&.Mui-disabled': { opacity: 0.5 },
        }}>
          {q}
        </ButtonBase>
      ))}
    </Box>
  )
}

export function MicIcon({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}

/**
 * Mic + text box + Send. Spoken words are sent as soon as they finish (3s silence);
 * if sending isn't possible right then, they're left in the box.
 */
export function Composer({ lang, canSend, placeholder, onSend, autoListen, onAutoListenUsed, listeningBubble }: {
  lang: string
  canSend: boolean
  placeholder: string
  onSend: (text: string) => boolean
  autoListen?: boolean
  onAutoListenUsed?: () => void
  listeningBubble: (node: ReactNode) => void
}) {
  const [text, setText] = useState('')
  const mic = useListen(lang, (said) => {
    if (canSend && onSend(said)) return
    setText(said)
  })

  useEffect(() => {
    if (!autoListen || !canSend) return
    if (canListen) mic.start()
    onAutoListenUsed?.()
  }, [autoListen, canSend, mic, onAutoListenUsed])

  // Show what's being heard as a dashed bubble in the thread (owned by the screen).
  useEffect(() => {
    listeningBubble(mic.listening ? (
      <Box sx={{ fontSize: 21, lineHeight: 1.35, px: '18px', py: '14px', borderRadius: '24px', borderBottomRightRadius: '8px', maxWidth: '92%', my: 1.5, ml: 'auto', width: 'fit-content', border: `2px dashed ${tokens.line}`, color: tokens.ink2 }}>
        {mic.interim || 'Listening…'}
      </Box>
    ) : mic.error !== null ? (
      <Typography sx={{ color: tokens.sos, fontSize: 17, my: 1 }}>{mic.error}</Typography>
    ) : null)
  }, [mic.listening, mic.interim, mic.error, listeningBubble])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    stopSpeaking()
    if (canSend && onSend(text)) setText('')
  }

  return (
    <Box component="form" onSubmit={submit} sx={{ display: 'flex', gap: 1, p: 1.5, borderTop: `1px solid ${tokens.line}`, flex: 'none', bgcolor: tokens.paper, alignItems: 'center' }}>
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
        value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder}
        inputProps={{ maxLength: 1000, 'aria-label': 'Message' }}
        sx={{ flex: 1, fontSize: 20, px: 2, py: 1, border: `2px solid ${tokens.line}`, borderRadius: '18px', bgcolor: tokens.white }}
      />
      <Button type="submit" variant="contained" disabled={!canSend || text.trim() === ''} sx={{ fontSize: 19, px: 2.5, borderRadius: '18px' }}>
        Send
      </Button>
    </Box>
  )
}
