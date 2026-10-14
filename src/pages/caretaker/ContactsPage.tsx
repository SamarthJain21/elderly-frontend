import { useState } from 'react'
import {
  Alert, Box, Button, Chip as MuiChip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, MenuItem, Switch, TextField, Typography,
} from '@mui/material'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import type { Contact, ContactIn, ContactKind, HelpRequest } from '../../lib/types'
import { Avatar, Card, Eyebrow, Pill, SectionTitle } from '../../components/ui'
import { useElder } from './elderContext'
import { tokens } from '../../theme'

const KINDS: { value: ContactKind; label: string }[] = [
  { value: 'family', label: 'Family' },
  { value: 'friend', label: 'Friend' },
  { value: 'neighbour', label: 'Neighbour' },
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'doctor', label: 'Doctor' },
]
const SKILL_IDEAS = ['plumbing', 'electrical', 'tech help', 'shopping', 'company', 'cooking', 'transport']
const EMPTY: ContactIn = { name: '', phone: '', kind: 'family', relationship: '', skills: [], trusted: false, email: '' }

const REQ_STATUS: Record<HelpRequest['status'], { tone: 'ok' | 'warn' | 'bad' | 'info' | 'plum'; label: string }> = {
  open: { tone: 'bad', label: 'Needs a helper' },
  notified: { tone: 'info', label: 'Volunteer asked' },
  confirmed: { tone: 'warn', label: 'Confirmed' },
  done: { tone: 'ok', label: 'Done' },
  cancelled: { tone: 'plum', label: 'Cancelled' },
}

function ContactDialog({ initial, onClose, onSave }: {
  initial: ContactIn
  onClose: () => void
  onSave: (c: ContactIn) => Promise<void>
}) {
  const [c, setC] = useState(initial)
  const [skillText, setSkillText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const addSkill = (s: string) => {
    const v = s.trim().toLowerCase()
    if (v && !c.skills.includes(v)) setC({ ...c, skills: [...c.skills, v] })
    setSkillText('')
  }
  const save = async () => {
    if (c.name.trim() === '' || c.phone.trim().length < 5) return setError('Name and phone are required.')
    setBusy(true)
    try {
      await onSave({ ...c, name: c.name.trim(), phone: c.phone.trim() })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
      setBusy(false)
    }
  }
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontFamily: 'Fraunces, serif' }}>{initial.name ? `Edit ${initial.name}` : 'Add a person'}</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        {error !== null && <Alert severity="error">{error}</Alert>}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <TextField label="Name" required value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
          <TextField label="Phone" required type="tel" placeholder="+91 98765 43210" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} />
          <TextField select label="Who are they?" value={c.kind} onChange={(e) => setC({ ...c, kind: e.target.value as ContactKind })}>
            {KINDS.map((k) => <MenuItem key={k.value} value={k.value}>{k.label}</MenuItem>)}
          </TextField>
          <TextField label="Relationship" placeholder="son, neighbour in 4B…" value={c.relationship} onChange={(e) => setC({ ...c, relationship: e.target.value })} />
        </Box>
        {c.kind === 'volunteer' && (
          <Box sx={{ display: 'grid', gap: 1 }}>
            <Eyebrow>What can they help with?</Eyebrow>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {c.skills.map((s) => <MuiChip key={s} label={s} onDelete={() => setC({ ...c, skills: c.skills.filter((x) => x !== s) })} />)}
              {SKILL_IDEAS.filter((s) => !c.skills.includes(s)).map((s) => (
                <MuiChip key={s} label={`+ ${s}`} variant="outlined" onClick={() => addSkill(s)} />
              ))}
            </Box>
            <TextField size="small" label="Other skill" value={skillText} onChange={(e) => setSkillText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(skillText) } }} />
          </Box>
        )}
        <FormControlLabel control={<Switch checked={c.trusted} onChange={(e) => setC({ ...c, trusted: e.target.checked })} />}
          label="⭐ Trusted — I know them personally" />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={busy} onClick={() => void save()}>Save</Button>
      </DialogActions>
    </Dialog>
  )
}

export function ContactsPage() {
  const { elder } = useElder()
  const base = `/elders/${elder.elderId}`
  const people = useApi<Contact[]>(`${base}/contacts`)
  const requests = useApi<HelpRequest[]>(`${base}/requests?limit=20`)
  const [editing, setEditing] = useState<{ id: string | null; data: ContactIn } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const firstName = elder.name.split(' ')[0] ?? elder.name

  const save = async (data: ContactIn) => {
    if (editing?.id) await api(`${base}/contacts/${editing.id}`, { method: 'PUT', body: JSON.stringify(data) })
    else await api(`${base}/contacts`, { method: 'POST', body: JSON.stringify(data) })
    setEditing(null)
    people.reload()
  }
  const remove = async (c: Contact) => {
    if (!window.confirm(`Remove ${c.name}?`)) return
    try {
      await api(`${base}/contacts/${c.id}`, { method: 'DELETE' })
      people.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove')
    }
  }
  const setStatus = async (r: HelpRequest, status: 'confirmed' | 'done' | 'cancelled') => {
    try {
      await api(`${base}/requests/${r.id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
      requests.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update')
    }
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Typography sx={{ color: tokens.ink2, flex: 1, minWidth: 240 }}>
          People {firstName} can call, and volunteers Elderly can ask for help. Elderly sees names and relationships — never phone numbers.
        </Typography>
        <Button variant="contained" onClick={() => setEditing({ id: null, data: EMPTY })}>+ Add person</Button>
      </Box>
      {error !== null && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      <Card sx={{ mt: 2 }}>
        {people.data === null && <CircularProgress size={22} />}
        {people.data?.length === 0 && <Typography sx={{ color: tokens.muted }}>No one yet. Add family first, then a trusted neighbour or volunteer.</Typography>}
        {people.data?.map((c) => (
          <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, '& + &': { borderTop: `1px solid ${tokens.line}` } }}>
            <Avatar name={c.name} size={40} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700 }}>{c.name} {c.trusted && '⭐'}</Typography>
              <Typography sx={{ fontSize: 13, color: tokens.muted }}>
                {[KINDS.find((k) => k.value === c.kind)?.label, c.relationship, c.phone].filter(Boolean).join(' · ')}
              </Typography>
              {c.skills.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>{c.skills.map((s) => <Pill key={s} tone="info">{s}</Pill>)}</Box>
              )}
            </Box>
            <Button size="small" onClick={() => setEditing({ id: c.id, data: c })}>Edit</Button>
            <IconButton aria-label={`Remove ${c.name}`} onClick={() => void remove(c)} sx={{ color: tokens.muted }}>×</IconButton>
          </Box>
        ))}
      </Card>

      <SectionTitle>Help requests</SectionTitle>
      <Card>
        {requests.data?.length === 0 && <Typography sx={{ color: tokens.muted }}>When {firstName} asks for help at home, it shows up here.</Typography>}
        {requests.data?.map((r) => {
          const st = REQ_STATUS[r.status]
          const active = r.status !== 'done' && r.status !== 'cancelled'
          return (
            <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', py: 1.25, '& + &': { borderTop: `1px solid ${tokens.line}` } }}>
              <Box sx={{ flex: 1, minWidth: 220 }}>
                <Typography sx={{ fontWeight: 700 }}>🙋 {r.title}</Typography>
                <Typography sx={{ fontSize: 13, color: tokens.muted }}>
                  {[r.skill, r.preferredTime, r.volunteerName ? `asked ${r.volunteerName}${r.notifiedVia.includes('sms') ? ' by text' : ' (text not sent — SMS not set up)'}` : null,
                    new Date(r.createdAt).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
              <Pill tone={st.tone}>{st.label}</Pill>
              {active && (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {r.status !== 'confirmed' && <Button size="small" onClick={() => void setStatus(r, 'confirmed')}>Confirmed</Button>}
                  <Button size="small" onClick={() => void setStatus(r, 'done')}>Done</Button>
                  <Button size="small" color="inherit" onClick={() => void setStatus(r, 'cancelled')}>Cancel</Button>
                </Box>
              )}
            </Box>
          )
        })}
      </Card>

      {editing !== null && <ContactDialog initial={editing.data} onClose={() => setEditing(null)} onSave={save} />}
    </Box>
  )
}
