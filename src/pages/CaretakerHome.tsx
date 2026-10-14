import { useState, type FormEvent } from 'react'
import { Alert, Box, Button, MenuItem, Paper, TextField, Typography } from '@mui/material'
import { api } from '../lib/api'
import { TopBar } from '../components/TopBar'

interface ElderCredentials {
  elderId: string
  email: string
  tempPassword: string
}

const LANGUAGES = [
  { value: 'en-US', label: 'English' },
  { value: 'hi-IN', label: 'Hindi' },
  { value: 'th-TH', label: 'Thai' },
] as const

// Placeholder dashboard: just enough to create an elder login. Real UI follows the prototype.
export function CaretakerHome() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [language, setLanguage] = useState<string>('en-US')
  const [creds, setCreds] = useState<ElderCredentials | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      setCreds(await api<ElderCredentials>('/elders', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), language }),
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add elder')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <TopBar />
      <Box sx={{ maxWidth: 520, mx: 'auto', p: 2 }}>
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="h4" component="h1" sx={{ fontSize: 24, mb: 2 }}>Add the person you care for</Typography>
          {creds !== null ? (
            <Alert severity="success">
              Share these login details with them:<br />
              Email: <b>{creds.email}</b><br />
              Password: <b>{creds.tempPassword}</b><br />
              They won't be shown again.
            </Alert>
          ) : (
            <Box component="form" onSubmit={(e) => void onSubmit(e)} sx={{ display: 'grid', gap: 2 }}>
              {error !== null && <Alert severity="error">{error}</Alert>}
              <TextField label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
              <TextField label="Phone" required value={phone} onChange={(e) => setPhone(e.target.value)} />
              <TextField select label="Language" value={language} onChange={(e) => setLanguage(e.target.value)}>
                {LANGUAGES.map((l) => <MenuItem key={l.value} value={l.value}>{l.label}</MenuItem>)}
              </TextField>
              <Button type="submit" variant="contained" disabled={busy}>Create login</Button>
            </Box>
          )}
        </Paper>
      </Box>
    </>
  )
}
