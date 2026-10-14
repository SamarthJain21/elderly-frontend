import { useState, type FormEvent } from 'react'
import { Alert, Box, Button, TextField, Typography } from '@mui/material'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import type { CaretakerInfo } from '../../lib/types'
import { Avatar, Card, Eyebrow } from '../../components/ui'
import { tokens } from '../../theme'

/** Everyone caring for this elder, plus inviting another family member by their Google email. */
export function CaretakersCard({ elderId, firstName }: { elderId: string; firstName: string }) {
  const list = useApi<CaretakerInfo[]>(`/elders/${elderId}/caretakers`)
  const [email, setEmail] = useState('')
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const invite = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setNote(null)
    try {
      const r = await api<{ status: 'added' | 'invited' }>(`/elders/${elderId}/caretakers`, {
        method: 'POST', body: JSON.stringify({ email: email.trim() }),
      })
      setNote({ ok: true, text: r.status === 'added'
        ? `Added. They can see ${firstName} now.`
        : `Invited. They'll be connected when they sign in to Elderly with Google using ${email.trim()}.` })
      setEmail('')
      list.reload()
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : 'Could not invite' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card sx={{ display: 'grid', gap: 1.5 }}>
      <Eyebrow>Caring for {firstName}</Eyebrow>
      {list.data?.map((c) => (
        <Box key={c.uid} sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Avatar name={c.name || c.email} size={34} />
          <Box>
            <Typography sx={{ fontWeight: 700 }}>{c.name}</Typography>
            <Typography sx={{ fontSize: 13, color: tokens.muted }}>{c.email}</Typography>
          </Box>
        </Box>
      ))}
      <Box component="form" onSubmit={(e) => void invite(e)} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
        <TextField size="small" type="email" label="Invite by Google email" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ flex: 1, minWidth: 220 }} />
        <Button type="submit" variant="outlined" disabled={busy || !email.includes('@')}>Invite</Button>
      </Box>
      {note !== null && <Alert severity={note.ok ? 'success' : 'error'}>{note.text}</Alert>}
    </Card>
  )
}
