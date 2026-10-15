import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Alert, Box, Typography } from '@mui/material'
import { useAuth } from '../../auth/AuthContext'
import { useChat } from '../../lib/useChat'
import type { ElderProfile } from '../../lib/types'
import { useApi } from '../../lib/useApi'
import { stopSpeaking } from '../../lib/speech'
import { Bubble, ChatHeader, Composer } from './chatKit'
import { FamilyChips, SystemNote } from '../../components/FamilyChips'
import { markFamilySeen, useSpeakNewest, useVoice } from './chatHooks'
import { tokens } from '../../theme'

function time(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}

/** The elder's messages with their family — separate from talking to Elderly. */
export function ElderFamily() {
  const { state } = useAuth()
  const elderId = state.status === 'ready' ? state.me.uid : null
  const { family, status, error, sendFamily, runChip } = useChat(elderId)
  const profile = useApi<ElderProfile>(elderId && `/elders/${elderId}`)
  const lang = profile.data?.language ?? 'en-US'
  const voice = useVoice(lang)
  const endRef = useRef<HTMLDivElement>(null)
  const [listening, setListening] = useState<ReactNode>(null)

  const last = family.at(-1)
  const lastFromFamily = family.findLast((m) => m.sender === 'caretaker')
  const names = [...new Set(family.filter((m) => m.sender === 'caretaker').map((m) => m.senderName))]
  const title = names.length === 1 ? names[0] : 'Family'

  // Opening this screen marks everything here as read (drives the home badge and the chat banner).
  useEffect(() => {
    if (elderId !== null && last !== undefined) markFamilySeen(elderId, last.createdAt)
  }, [elderId, last])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [family.length, listening])

  useSpeakNewest(last?.id ?? null, last?.sender === 'caretaker' ? `${last.senderName}: ${last.text}` : null,
    status === 'open', voice.on && voice.hasVoice, lang)

  // One-tap answers/actions for the newest message from family, until something newer arrives.
  const chipsFor = last !== undefined && last.sender === 'caretaker' ? last : null
  const canSend = status === 'open'
  const onSend = (text: string) => {
    stopSpeaking()
    return sendFamily(text, 'family_reply')
  }

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', maxWidth: 640, mx: 'auto', bgcolor: tokens.paper }}>
      <ChatHeader title={title} lang={lang} voice={voice} />
      {status === 'reconnecting' && <Alert severity="warning" sx={{ borderRadius: 0 }}>Connecting again…</Alert>}

      <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 1 }} aria-live="polite">
        {status === 'open' && family.length === 0 && (
          <Typography sx={{ fontSize: 21, color: tokens.ink2, mt: 2 }}>
            Messages from your family will appear here. You can send them a message too.
          </Typography>
        )}
        {family.map((m) => {
          if (m.sender === 'system') return <SystemNote key={m.id} text={m.text} size="elder" />
          const mine = m.sender === 'elder'
          return (
            <Bubble key={m.id} mine={mine} tone="family" label={mine ? undefined : m.senderName}
              footer={
                <Box component="span" sx={{ display: 'block', fontSize: 13, opacity: 0.7, mt: 0.5, textAlign: mine ? 'right' : 'left' }}>
                  {time(m.createdAt)}{m.viaAgent ? ' · sent by Elderly' : ''}
                </Box>
              }>
              {m.text}
            </Bubble>
          )
        })}
        {listening}
        {error !== null && <Alert severity="warning" sx={{ my: 1.5, fontSize: 17 }}>{error}</Alert>}
        {chipsFor !== null && (
          <FamilyChips message={chipsFor} size="elder" disabled={!canSend}
            onSend={(text) => onSend(text)} onRun={(id, i) => { stopSpeaking(); runChip(id, i) }} />
        )}
        <div ref={endRef} />
      </Box>

      <Composer lang={lang} canSend={canSend}
        placeholder={lastFromFamily ? `Message ${lastFromFamily.senderName}…` : 'Message your family…'}
        onSend={onSend} listeningBubble={setListening} />
    </Box>
  )
}
