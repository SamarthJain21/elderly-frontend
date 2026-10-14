import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Alert, Box, Button, MenuItem, TextField, Typography } from '@mui/material'
import { api } from '../../lib/api'
import type { Language } from '../../lib/types'
import { Card } from '../../components/ui'
import { useCaretaker } from './caretakerContext'
import { tokens } from '../../theme'

interface ElderCredentials {
  elderId: string
  email: string
  tempPassword: string
}

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en-US', label: 'English' },
  { value: 'hi-IN', label: 'हिन्दी (Hindi)' },
  { value: 'th-TH', label: 'ไทย (Thai)' },
]

export function AddElderPage() {
  const { reloadElders } = useCaretaker()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [language, setLanguage] = useState<Language>('en-US')
  const [creds, setCreds] = useState<ElderCredentials | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const c = await api<ElderCredentials>('/elders', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), language }),
      })
      setCreds(c)
      reloadElders()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add person')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ maxWidth: 560 }}>
      <Typography variant="h3" component="h1" sx={{ fontSize: 30, mb: 0.5 }}>Add the person you care for</Typography>
      <Typography sx={{ color: tokens.muted, mb: 3 }}>We'll create a simple login for them.</Typography>
      <Card>
        {creds !== null ? (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Alert severity="success">
              Share these login details with {name}. They won't be shown again.
            </Alert>
            <Box sx={{ bgcolor: tokens.bg, borderRadius: '12px', p: 2, fontSize: 18, wordBreak: 'break-all' }}>
              <div>Email: <b>{creds.email}</b></div>
              <div>Password: <b>{creds.tempPassword}</b></div>
            </Box>
            <Button variant="contained" onClick={() => void navigate(`/caretaker/elders/${creds.elderId}/assessment`)}>
              Continue to assessment
            </Button>
          </Box>
        ) : (
          <Box component="form" onSubmit={(e) => void onSubmit(e)} sx={{ display: 'grid', gap: 2 }}>
            {error !== null && <Alert severity="error">{error}</Alert>}
            <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
            <TextField label="Phone" required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <TextField select label="Language they speak" value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
              {LANGUAGES.map((l) => <MenuItem key={l.value} value={l.value}>{l.label}</MenuItem>)}
            </TextField>
            <Button type="submit" variant="contained" disabled={busy}>Create login</Button>
          </Box>
        )}
      </Card>
    </Box>
  )
}
