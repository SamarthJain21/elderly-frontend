import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import {
  Alert, Box, Button, CircularProgress, IconButton, MenuItem, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { ALL_DAYS, DAY_LABEL, type Day, REMINDER_ICON, type ElderProfile, type Reminder } from '../../lib/types'
import { Avatar, Card, Chip, Eyebrow, Pill, SectionTitle } from '../../components/ui'
import { tokens } from '../../theme'
import { CheckInSection } from './CheckInSection'

function daysLabel(days: Day[]): string {
  if (days.length === 7) return 'Every day'
  if (days.join() === 'mon,tue,wed,thu,fri') return 'Weekdays'
  return days.map((d) => DAY_LABEL[d]).join(', ')
}

function scheduleLabel(r: Reminder): string {
  if (r.date !== null) return new Date(`${r.date}T00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  return daysLabel(r.days ?? [])
}

function Row({ icon, title, sub, action }: { icon: string; title: string; sub: string; action?: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, '& + &': { borderTop: `1px solid ${tokens.line}` } }}>
      <Box sx={{ width: 36, height: 36, borderRadius: '10px', bgcolor: tokens.bg, display: 'grid', placeItems: 'center', flex: 'none' }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
        <Typography sx={{ fontSize: 13, color: tokens.muted }}>{sub}</Typography>
      </Box>
      {action}
    </Box>
  )
}

function AddReminderForm({ elderId, onAdded }: { elderId: string; onAdded: () => void }) {
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<'custom' | 'appointment'>('custom')
  const [time, setTime] = useState('10:00')
  const [mode, setMode] = useState<'repeat' | 'once'>('repeat')
  const [days, setDays] = useState<Day[]>([...ALL_DAYS])
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA')) // local YYYY-MM-DD, not UTC
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (mode === 'repeat' && days.length === 0) return setError('Pick at least one day.')
    setError(null)
    setBusy(true)
    try {
      await api(`/elders/${elderId}/reminders`, {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), kind, time, ...(mode === 'repeat' ? { days } : { date }) }),
      })
      setTitle('')
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add reminder')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box component="form" onSubmit={(e) => void submit(e)} sx={{ display: 'grid', gap: 2, mt: 2, pt: 2, borderTop: `1px solid ${tokens.line}` }}>
      <Eyebrow>New reminder</Eyebrow>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 1fr' }, gap: 2 }}>
        <TextField label="What" required placeholder="Drink water, Doctor visit…" value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextField select label="Type" value={kind} onChange={(e) => setKind(e.target.value as 'custom' | 'appointment')}>
          <MenuItem value="custom">⏰ Reminder</MenuItem>
          <MenuItem value="appointment">📅 Appointment</MenuItem>
        </TextField>
        <TextField label="Time" type="time" required value={time} onChange={(e) => setTime(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      </Box>
      <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v: 'repeat' | 'once' | null) => v && setMode(v)}>
        <ToggleButton value="repeat">Repeats</ToggleButton>
        <ToggleButton value="once">One time</ToggleButton>
      </ToggleButtonGroup>
      {mode === 'repeat' ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {ALL_DAYS.map((d) => (
            <Chip key={d} on={days.includes(d)} onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : ALL_DAYS.filter((x) => x === d || days.includes(x)))}>
              {DAY_LABEL[d]}
            </Chip>
          ))}
        </Box>
      ) : (
        <TextField label="Date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ maxWidth: 220 }} />
      )}
      {error !== null && <Alert severity="error">{error}</Alert>}
      <Box><Button type="submit" variant="contained" disabled={busy || title.trim() === ''}>Add reminder</Button></Box>
    </Box>
  )
}

export function ElderOverviewPage() {
  const { elderId = '' } = useParams()
  const { data: elder, error } = useApi<ElderProfile>(`/elders/${elderId}`)
  const reminders = useApi<Reminder[]>(elder?.assessment ? `/elders/${elderId}/reminders` : null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  if (error !== null) return <Alert severity="error">{error}</Alert>
  if (elder === null) return <CircularProgress />
  const a = elder.assessment

  const remove = async (id: string) => {
    setDeleteError(null)
    try {
      await api(`/elders/${elderId}/reminders/${id}`, { method: 'DELETE' })
      reminders.reload()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete')
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Avatar name={elder.name} size={56} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h3" component="h1" sx={{ fontSize: 30 }}>{elder.name}</Typography>
          <Typography sx={{ color: tokens.muted }}>{elder.phone}</Typography>
        </Box>
        {a !== null && <Button variant="outlined" component={Link} to={`/caretaker/elders/${elderId}/assessment`}>Edit assessment</Button>}
      </Box>

      {a === null ? (
        <Card sx={{ mt: 3, bgcolor: tokens.amberSoft, borderColor: 'transparent' }}>
          <Typography variant="h4" component="h2" sx={{ fontSize: 22, mb: 0.5 }}>Set up {elder.name}'s routine</Typography>
          <Typography sx={{ color: tokens.ink2, mb: 2 }}>
            Sleep, meals and medicines — Elderly uses this for daily check-ins and reminders.
          </Typography>
          <Button variant="contained" component={Link} to={`/caretaker/elders/${elderId}/assessment`}>Start assessment</Button>
        </Card>
      ) : (
        <>
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0,1fr))' }, mt: 3 }}>
            <Card>
              <Eyebrow>Routine</Eyebrow>
              <Typography sx={{ mt: 1 }}>🌅 Wakes {a.sleep.wakeTime}</Typography>
              <Typography>🌙 Bed {a.sleep.bedtime}</Typography>
              <Typography sx={{ fontSize: 13, color: tokens.muted, mt: 1 }}>{a.timezone.replace('_', ' ')}</Typography>
            </Card>
            <Card>
              <Eyebrow>Medicines</Eyebrow>
              <Typography sx={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 650, mt: 0.5 }}>{a.medications.length}</Typography>
              <Typography sx={{ fontSize: 13, color: tokens.muted }}>
                {a.medications.reduce((n, m) => n + m.times.length, 0)} doses a day
              </Typography>
            </Card>
            <Card>
              <Eyebrow>Daily check-in</Eyebrow>
              <Typography sx={{ fontFamily: 'Fraunces, serif', fontSize: 28, fontWeight: 650, mt: 0.5 }}>{a.checkIn.time}</Typography>
              <Typography sx={{ fontSize: 13, color: tokens.muted }}>{daysLabel(a.checkIn.days)}</Typography>
            </Card>
          </Box>

          {a.healthNotes !== '' && (
            <Box sx={{ mt: 2 }}><Pill tone="info">ℹ️ {a.healthNotes}</Pill></Box>
          )}

          <CheckInSection elderId={elderId} />

          <SectionTitle>Reminders</SectionTitle>
          <Card>
            {reminders.loading && reminders.data === null && <CircularProgress size={22} />}
            {reminders.error !== null && <Alert severity="error">{reminders.error}</Alert>}
            {deleteError !== null && <Alert severity="error" sx={{ mb: 1 }}>{deleteError}</Alert>}
            {reminders.data?.length === 0 && <Typography sx={{ color: tokens.muted }}>No reminders yet.</Typography>}
            {reminders.data?.map((r) => (
              <Row key={r.id} icon={REMINDER_ICON[r.kind]} title={`${r.time} · ${r.title}`}
                sub={r.kind === 'medication' ? `${scheduleLabel(r)} · from medicines` : scheduleLabel(r)}
                action={r.kind !== 'medication' && (
                  <IconButton aria-label={`Delete ${r.title}`} onClick={() => void remove(r.id)} sx={{ color: tokens.muted }}>×</IconButton>
                )} />
            ))}
            <AddReminderForm elderId={elderId} onAdded={reminders.reload} />
          </Card>
        </>
      )}
    </Box>
  )
}
