import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, IconButton, MenuItem,
  Step, StepLabel, Stepper, TextField, Typography,
} from '@mui/material'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { ALL_DAYS, DAY_LABEL, type Assessment, type Day, type ElderProfile, type Medication } from '../../lib/types'
import { Card, Chip, Eyebrow } from '../../components/ui'
import { useCaretaker } from './caretakerContext'
import { tokens } from '../../theme'

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Bangkok', label: 'Thailand (ICT)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
]

const STEPS = ['Daily routine', 'Medicines', 'Check-ins'] as const

function defaultAssessment(): Assessment {
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  return {
    timezone: TIMEZONES.some((t) => t.value === browserTz) ? browserTz : 'Asia/Kolkata',
    sleep: { bedtime: '22:00', wakeTime: '06:30' },
    meals: { breakfast: '08:00', lunch: '13:00', dinner: '19:30' },
    medications: [],
    checkIn: { time: '09:00', days: [...ALL_DAYS] },
    healthNotes: '',
  }
}

const emptyMed = (): Medication => ({ name: '', dose: '', times: ['08:00'], withFood: false, notes: '' })

function TimeField({ label, value, onChange, required = true }: {
  label: string; value: string | null; onChange: (v: string | null) => void; required?: boolean
}) {
  return (
    <TextField
      label={label} type="time" required={required} value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
      slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 300 } }}
    />
  )
}

export function AssessmentPage() {
  const { elderId = '' } = useParams()
  const { data: elder, error } = useApi<ElderProfile>(`/elders/${elderId}`)
  if (error !== null) return <Alert severity="error">{error}</Alert>
  if (elder === null) return <CircularProgress />
  // key: remount the form (fresh state) if the route switches to another elder.
  return <AssessmentForm key={elder.elderId} elder={elder} />
}

function AssessmentForm({ elder }: { elder: ElderProfile }) {
  const elderId = elder.elderId
  const navigate = useNavigate()
  const { reloadElders } = useCaretaker()
  const [a, setA] = useState<Assessment>(() => elder.assessment ?? defaultAssessment())
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = (patch: Partial<Assessment>) => setA({ ...a, ...patch })
  const setMed = (i: number, patch: Partial<Medication>) =>
    set({ medications: a.medications.map((m, j) => (j === i ? { ...m, ...patch } : m)) })

  const stepError = (): string | null => {
    if (step === 1) {
      const bad = a.medications.findIndex((m) => m.name.trim() === '' || m.times.length === 0 || m.times.some((t) => t === ''))
      if (bad >= 0) return `Medicine ${bad + 1} needs a name and at least one time.`
    }
    if (step === 2 && a.checkIn.days.length === 0) return 'Pick at least one day for check-ins.'
    return null
  }

  const next = async () => {
    const msg = stepError()
    setError(msg)
    if (msg !== null) return
    if (step < STEPS.length - 1) {
      setStep(step + 1)
      return
    }
    setBusy(true)
    try {
      const body: Assessment = { ...a, medications: a.medications.map((m) => ({ ...m, name: m.name.trim() })) }
      await api<Assessment>(`/elders/${elderId}/assessment`, { method: 'PUT', body: JSON.stringify(body) })
      reloadElders()
      void navigate(`/caretaker/elders/${elderId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  const toggleDay = (d: Day) => {
    const days = a.checkIn.days.includes(d) ? a.checkIn.days.filter((x) => x !== d) : [...a.checkIn.days, d]
    set({ checkIn: { ...a.checkIn, days: ALL_DAYS.filter((x) => days.includes(x)) } })
  }

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Eyebrow>Assessment</Eyebrow>
      <Typography variant="h3" component="h1" sx={{ fontSize: 30, mb: 3 }}>{elder.name}'s routine</Typography>

      <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
        {STEPS.map((s) => <Step key={s}><StepLabel>{s}</StepLabel></Step>)}
      </Stepper>

      <Card sx={{ display: 'grid', gap: 2.5 }}>
        {step === 0 && (
          <>
            <TextField select label="Where they live" value={a.timezone} onChange={(e) => set({ timezone: e.target.value })}>
              {TIMEZONES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
            </TextField>
            <Eyebrow>Sleep</Eyebrow>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TimeField label="Wakes up" value={a.sleep.wakeTime} onChange={(v) => set({ sleep: { ...a.sleep, wakeTime: v ?? '' } })} />
              <TimeField label="Goes to bed" value={a.sleep.bedtime} onChange={(v) => set({ sleep: { ...a.sleep, bedtime: v ?? '' } })} />
            </Box>
            <Eyebrow>Meals (optional)</Eyebrow>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
              {(['breakfast', 'lunch', 'dinner'] as const).map((meal) => (
                <TimeField key={meal} required={false} label={meal[0].toUpperCase() + meal.slice(1)}
                  value={a.meals[meal]} onChange={(v) => set({ meals: { ...a.meals, [meal]: v } })} />
              ))}
            </Box>
            <TextField label="Health notes (optional)" multiline minRows={2} value={a.healthNotes}
              placeholder="e.g. High blood pressure, uses a walker, hard of hearing"
              onChange={(e) => set({ healthNotes: e.target.value })} />
          </>
        )}

        {step === 1 && (
          <>
            {a.medications.length === 0 && (
              <Typography sx={{ color: tokens.muted }}>No medicines yet. Add each one with the times they take it.</Typography>
            )}
            {a.medications.map((m, i) => (
              <Box key={m.id ?? `new-${i}`} sx={{ border: `1px solid ${tokens.line}`, borderRadius: '14px', p: 2, display: 'grid', gap: 2, bgcolor: tokens.white }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ fontSize: 22 }}>💊</Box>
                  <Typography sx={{ fontWeight: 700, flex: 1 }}>Medicine {i + 1}</Typography>
                  <Button size="small" color="error" onClick={() => set({ medications: a.medications.filter((_, j) => j !== i) })}>Remove</Button>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: 2 }}>
                  <TextField label="Name" required value={m.name} onChange={(e) => setMed(i, { name: e.target.value })} />
                  <TextField label="Dose" placeholder="5mg" value={m.dose} onChange={(e) => setMed(i, { dose: e.target.value })} />
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
                  {m.times.map((t, ti) => (
                    <Box key={ti} sx={{ display: 'flex', alignItems: 'center' }}>
                      <TimeField label={`Time ${ti + 1}`} value={t}
                        onChange={(v) => setMed(i, { times: m.times.map((x, k) => (k === ti ? v ?? '' : x)) })} />
                      {m.times.length > 1 && (
                        <IconButton aria-label="Remove time" size="small" onClick={() => setMed(i, { times: m.times.filter((_, k) => k !== ti) })}>×</IconButton>
                      )}
                    </Box>
                  ))}
                  {m.times.length < 8 && (
                    <Button size="small" variant="outlined" onClick={() => setMed(i, { times: [...m.times, '20:00'] })}>+ Time</Button>
                  )}
                </Box>
                <FormControlLabel control={<Checkbox checked={m.withFood} onChange={(e) => setMed(i, { withFood: e.target.checked })} />} label="Take with food" />
              </Box>
            ))}
            <Button variant="outlined" onClick={() => set({ medications: [...a.medications, emptyMed()] })}>+ Add medicine</Button>
          </>
        )}

        {step === 2 && (
          <>
            <Typography sx={{ color: tokens.ink2 }}>
              Elderly will check in with {elder.name} every day at this time — mood, sleep, meals and medicines.
            </Typography>
            <Box sx={{ maxWidth: 220 }}>
              <TimeField label="Check-in time" value={a.checkIn.time} onChange={(v) => set({ checkIn: { ...a.checkIn, time: v ?? '' } })} />
            </Box>
            <Eyebrow>Days</Eyebrow>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {ALL_DAYS.map((d) => <Chip key={d} on={a.checkIn.days.includes(d)} onClick={() => toggleDay(d)}>{DAY_LABEL[d]}</Chip>)}
            </Box>
          </>
        )}

        {error !== null && <Alert severity="error">{error}</Alert>}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, pt: 1 }}>
          <Button variant="outlined" disabled={step === 0 || busy} onClick={() => { setError(null); setStep(step - 1) }}>Back</Button>
          <Button variant="contained" disabled={busy} onClick={() => void next()}>
            {step < STEPS.length - 1 ? 'Next' : 'Save assessment'}
          </Button>
        </Box>
      </Card>
    </Box>
  )
}
