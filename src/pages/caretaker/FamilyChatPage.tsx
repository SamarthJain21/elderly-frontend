import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Alert, Box, Button, ButtonBase, InputBase, Typography } from '@mui/material'
import { useAuth } from '../../auth/AuthContext'
import { useChat } from '../../lib/useChat'
import type { FamilyMessage } from '../../lib/types'
import { Card } from '../../components/ui'
import { FamilyChips, SystemNote } from '../../components/FamilyChips'
import { useElder } from './elderContext'
import { tokens } from '../../theme'

// Prototype EMMA_PRESETS. The elder gets one-tap answers for each.
const PRESETS = ['💊 Did you take your medicine?', '😊 How are you feeling today?', '🍲 Shall I order dinner?']

function time(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}

function Row({ m, mine, elderName }: { m: FamilyMessage; mine: boolean; elderName: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', my: 1.25 }}>
      <Box sx={{
        px: 2, py: 1.25, borderRadius: '18px', maxWidth: '80%', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
        ...(mine
          ? { bgcolor: tokens.ink, color: tokens.white, borderBottomRightRadius: '6px' }
          : m.sender === 'elder'
            ? { bgcolor: tokens.accentSoft, borderBottomLeftRadius: '6px' }
            : { bgcolor: tokens.plumSoft, borderBottomLeftRadius: '6px' }),
      }}>
        {!mine && (
          <Typography sx={{ fontSize: 12, fontWeight: 700, opacity: 0.65, textTransform: 'uppercase', letterSpacing: '.04em' }}>
            {m.sender === 'elder' ? elderName : m.senderName}
          </Typography>
        )}
        {m.text}
      </Box>
      <Typography sx={{ fontSize: 12, color: tokens.muted, mt: 0.5 }}>
        {time(m.createdAt)}
        {m.viaAgent && ' · passed on by Elderly'}
        {m.sender === 'caretaker' && m.chips.length > 0 && ` · their options: ${m.chips.map((c) => c.label).join(' / ')}`}
      </Typography>
    </Box>
  )
}

export function FamilyChatPage() {
  const { elder } = useElder()
  const { state } = useAuth()
  const myUid = state.status === 'ready' ? state.me.uid : ''
  const { family, status, error, sendFamily, runChip } = useChat(elder.elderId)
  const newest = family.at(-1)
  // Suggested next steps appear under the elder's newest message until someone replies.
  const chipsFor = newest !== undefined && newest.sender === 'elder' ? newest : null
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const firstName = elder.name.split(' ')[0] ?? elder.name

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [family.length])

  const send = (value: string) => {
    if (sendFamily(value, 'family_message')) setText('')
  }
  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    send(text)
  }

  return (
    <Card sx={{ mt: 2, p: 0, display: 'flex', flexDirection: 'column', height: { xs: '70dvh', md: 560 } }}>
      <Box sx={{ flex: 1, overflowY: 'auto', px: 2.5, py: 1.5 }}>
        {status === 'connecting' && <Typography sx={{ color: tokens.muted }}>Connecting…</Typography>}
        {status === 'reconnecting' && <Alert severity="warning">Connecting again…</Alert>}
        {status === 'open' && family.length === 0 && (
          <Typography sx={{ color: tokens.muted }}>
            Send {firstName} a message. It's read aloud to them, with one-tap answers.
          </Typography>
        )}
        {family.map((m) => m.sender === 'system'
          ? <SystemNote key={m.id} text={m.text} size="caretaker" />
          : <Row key={m.id} m={m} mine={m.sender === 'caretaker' && m.senderUid === myUid} elderName={firstName} />)}
        {chipsFor !== null && (
          // "💬 " marks a message suggestion; send the words, not the marker.
          <FamilyChips message={chipsFor} size="caretaker" disabled={status !== 'open'}
            onSend={(text) => send(text.replace(/^💬\s*/u, ''))} onRun={runChip} />
        )}
        {error !== null && <Alert severity="error" sx={{ my: 1 }}>{error}</Alert>}
        <div ref={endRef} />
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, px: 2, pt: 1.5, borderTop: `1px solid ${tokens.line}` }}>
        {PRESETS.map((p) => (
          <ButtonBase key={p} disabled={status !== 'open'} onClick={() => send(p.replace(/^\S+\s/, ''))} sx={{
            border: `1px solid ${tokens.line}`, bgcolor: tokens.white, borderRadius: 999, px: 1.5, py: 0.875,
            fontSize: 14, fontWeight: 700, '&:hover': { borderColor: tokens.ink2 },
          }}>
            {p}
          </ButtonBase>
        ))}
      </Box>
      <Box component="form" onSubmit={onSubmit} sx={{ display: 'flex', gap: 1, p: 1.5 }}>
        <InputBase value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${firstName}…`}
          inputProps={{ maxLength: 1000, 'aria-label': `Message ${firstName}` }}
          sx={{ flex: 1, px: 1.5, py: 0.75, border: `1px solid ${tokens.line}`, borderRadius: '12px', bgcolor: tokens.white }} />
        <Button type="submit" variant="contained" disabled={status !== 'open' || text.trim() === ''}>Send</Button>
      </Box>
    </Card>
  )
}
