import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Alert, Box, Button, ButtonBase, InputBase, Typography } from '@mui/material'
import { useAuth } from '../../auth/AuthContext'
import { useChat } from '../../lib/useChat'
import type { ChatMessage } from '../../lib/types'
import { tokens } from '../../theme'

// Mirrors the prototype's .msg / .msg.me / .msg.agent bubbles.
function Bubble({ m }: { m: ChatMessage }) {
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

export function ElderChat() {
  const { state } = useAuth()
  const elderId = state.status === 'ready' ? state.me.uid : null
  const { messages, status, typing, error, send } = useChat(elderId)
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, typing])

  const last = messages.at(-1)
  const suggestions = typing ? [] : last === undefined ? STARTERS : last.sender === 'agent' ? last.quickReplies : []
  const canSend = status === 'open' && !typing

  const submit = (value: string) => {
    if (canSend && send(value)) setText('')
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
        <Box sx={{ width: 64 }} />
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
        {messages.map((m) => <Bubble key={m.id} m={m} />)}
        {typing && <Typing />}
        {error !== null && <Alert severity="warning" sx={{ my: 1.5, fontSize: 17 }}>{error}</Alert>}

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

      <Box component="form" onSubmit={onSubmit} sx={{ display: 'flex', gap: 1, p: 1.5, borderTop: `1px solid ${tokens.line}`, flex: 'none', bgcolor: tokens.paper }}>
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
