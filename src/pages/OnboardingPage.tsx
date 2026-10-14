import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material'
import { api } from '../lib/api'
import { homeFor, useAuth, type Me } from '../auth/AuthContext'
import { FullPageSpinner } from '../auth/RequireRole'
import { Brand } from '../components/Brand'
import { tokens } from '../theme'

export function OnboardingPage() {
  const { state, refresh, signOut } = useAuth()
  const defaultName = state.status === 'needsOnboarding' ? (state.user.displayName ?? '') : ''
  const [name, setName] = useState(defaultName)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (state.status === 'loading') return <FullPageSpinner />
  if (state.status === 'signedOut') return <Navigate to="/login" replace />
  if (state.status === 'ready') return <Navigate to={homeFor(state.me.role)} replace />

  const isGoogle =
    state.status === 'needsOnboarding' &&
    state.user.providerData.some((p) => p.providerId === 'google.com')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await api<Me>('/onboarding/caretaker', { method: 'POST', body: JSON.stringify({ name: name.trim() }) })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish setup')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper variant="outlined" sx={{ width: '100%', maxWidth: 440, p: { xs: 3, sm: 4 } }}>
        <Box sx={{ mb: 3 }}><Brand /></Box>
        {!isGoogle ? (
          <>
            <Alert severity="warning" sx={{ mb: 2 }}>
              This account isn't set up yet. Ask your family member to check your login details.
            </Alert>
            <Button variant="outlined" onClick={() => void signOut()}>Sign out</Button>
          </>
        ) : (
          <Box component="form" onSubmit={(e) => void onSubmit(e)} sx={{ display: 'grid', gap: 2 }}>
            <Typography variant="h4" component="h1" sx={{ fontSize: 26 }}>Set up your carer account</Typography>
            <Typography sx={{ color: tokens.muted }}>
              You'll add the person you care for on the next screen.
            </Typography>
            {error !== null && <Alert severity="error">{error}</Alert>}
            <TextField label="Your name" required value={name} onChange={(e) => setName(e.target.value)} />
            <Button type="submit" variant="contained" disabled={busy || name.trim() === ''}>Continue</Button>
            <Button variant="text" onClick={() => void signOut()}>Use a different account</Button>
          </Box>
        )}
      </Paper>
    </Box>
  )
}
