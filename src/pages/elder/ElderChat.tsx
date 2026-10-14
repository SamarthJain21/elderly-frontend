import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Alert, Box, ButtonBase, Typography } from '@mui/material'
import { useAuth } from '../../auth/AuthContext'
import { useChat } from '../../lib/useChat'
import type { ChatMessage, ElderProfile, Mood } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { stopSpeaking } from '../../lib/speech'
import { ActionCardView } from '../../components/ActionCardView'
import { Bubble, ChatHeader, Composer, QuickReplies } from './chatKit'
import { familySeenAt, useSpeakNewest, useVoice } from './chatHooks'
import { tokens } from '../../theme'

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

function AgentBubble({ m, disabled, onAnswer }: { m: ChatMessage; disabled: boolean; onAnswer: (id: string, approve: boolean) => void }) {
  const mine = m.sender === 'elder'
  return (
    <Bubble mine={mine} label={mine ? undefined : 'Elderly'}>
      {m.text}
      {m.action != null && <ActionCardView card={m.action} disabled={disabled} onAnswer={(approve) => onAnswer(m.action!.id, approve)} />}
    </Bubble>
  )
}

const STARTERS = ['Good morning! 👋', 'I feel a bit lonely', 'What should I eat today?']

/** The elder's conversation with Elderly (the agent). Family messages live on their own screen. */
export function ElderChat() {
  const { state } = useAuth()
  const elderId = state.status === 'ready' ? state.me.uid : null
  const { messages, family, status, typing, error, checkin, send, startCheckIn, confirm } = useChat(elderId)
  const profile = useApi<ElderProfile>(elderId && `/elders/${elderId}`)
  const lang = profile.data?.language ?? 'en-US'
  const voice = useVoice(lang)
  const endRef = useRef<HTMLDivElement>(null)
  const [listening, setListening] = useState<ReactNode>(null)
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
  }, [messages.length, typing, listening])

  const last = messages.at(-1)
  useSpeakNewest(last?.id ?? null, last?.sender === 'agent' ? last.text : null, status === 'open', voice.on && voice.hasVoice, lang)

  // A family message arriving while they talk to Elderly: point them to it, don't mix it in.
  const newestFamily = family.findLast((m) => m.sender === 'caretaker')
  const unreadFamily = elderId !== null && newestFamily !== undefined && newestFamily.createdAt > familySeenAt(elderId)
    ? newestFamily : null

  const canSend = status === 'open' && !typing
  const suggestions = typing ? [] : last === undefined ? STARTERS : last.sender === 'agent' ? last.quickReplies : []
  const onSend = (text: string) => {
    stopSpeaking()
    return send(text)
  }
  const clearListenParam = useCallback(() => setParams({}, { replace: true }), [setParams])

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: 640, mx: 'auto', bgcolor: tokens.paper }}>
      <ChatHeader title="Elderly" lang={lang} voice={voice} />
      {checkin?.status === 'in_progress' && (
        <Box sx={{ px: 2, py: 0.75, bgcolor: tokens.amberSoft, color: tokens.amber, fontWeight: 700, fontSize: 16, flex: 'none' }}>
          📝 Daily check-in in progress
        </Box>
      )}

      {status === 'reconnecting' && <Alert severity="warning" sx={{ borderRadius: 0 }}>Connecting again…</Alert>}
      {status === 'denied' && <Alert severity="error" sx={{ borderRadius: 0 }}>Please sign in again.</Alert>}
      {unreadFamily !== null && (
        <ButtonBase component={Link} to="/elder/family" sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, bgcolor: tokens.plumSoft, color: tokens.plum,
          fontSize: 18, fontWeight: 700, flex: 'none', textAlign: 'left',
        }}>
          <Box component="span" sx={{ flex: 1, minWidth: 0 }}>💌 New message from {unreadFamily.senderName}</Box>
          <Box component="span" sx={{ whiteSpace: 'nowrap', bgcolor: tokens.white, borderRadius: '10px', px: 1.25, py: 0.5 }}>Open ›</Box>
        </ButtonBase>
      )}

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
          <AgentBubble key={m.id} m={m} disabled={status !== 'open' || typing} onAnswer={(id, approve) => { stopSpeaking(); confirm(id, approve) }} />
        ))}
        {typing && <Typing />}
        {listening}
        {error !== null && <Alert severity="warning" sx={{ my: 1.5, fontSize: 17 }}>{error}</Alert>}
        <QuickReplies options={suggestions} disabled={!canSend} onPick={(q) => onSend(q)} />
        <div ref={endRef} />
      </Box>

      <Composer lang={lang} canSend={canSend} placeholder="Talk to Elderly…" onSend={onSend}
        autoListen={params.get('listen') !== null && status === 'open'} onAutoListenUsed={clearListenParam}
        listeningBubble={setListening} />
    </Box>
  )
}
