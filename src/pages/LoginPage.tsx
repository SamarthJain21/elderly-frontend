import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { Alert, Box, Button, Divider, Paper, TextField, Typography } from '@mui/material'
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth'
import { FirebaseError } from 'firebase/app'
import { auth, googleProvider } from '../lib/firebase'
import { homeFor, useAuth } from '../auth/AuthContext'
import { Brand } from '../components/Brand'
import { FullPageSpinner } from '../auth/RequireRole'
import { tokens } from '../theme'

function messageFor(err: unknown): string {
  if (err instanceof FirebaseError) {
    if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password')
      return 'That email or password is not right. Please try again.'
    if (err.code === 'auth/popup-closed-by-user') return 'Sign-in window was closed.'
    if (err.code === 'auth/too-many-requests') return 'Too many tries. Please wait a minute.'
  }
  return 'Something went wrong. Please try again.'
}

// Elders type into these — keep them big.
const bigField = { '& .MuiInputBase-input': { fontSize: 22, py: 2 }, '& .MuiInputLabel-root': { fontSize: 18 } }

export function LoginPage() {
  const { state } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (state.status === 'loading') return <FullPageSpinner />
  if (state.status === 'ready') return <Navigate to={homeFor(state.me.role)} replace />
  if (state.status === 'needsOnboarding') return <Navigate to="/onboarding" replace />

  const run = async (fn: () => Promise<unknown>) => {
    setError(null)
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      setError(messageFor(err))
    } finally {
      setBusy(false)
    }
  }

  const onElderSubmit = (e: FormEvent) => {
    e.preventDefault()
    void run(() => signInWithEmailAndPassword(auth, email.trim(), password))
  }

  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper variant="outlined" sx={{ width: '100%', maxWidth: 440, p: { xs: 3, sm: 4 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <Brand size={28} />
        </Box>

        {state.status === 'error' && <Alert severity="error" sx={{ mb: 2 }}>{state.message}</Alert>}
        {error !== null && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Typography variant="h4" component="h1" sx={{ fontSize: 28, mb: 0.5 }}>
          Welcome
        </Typography>
        <Typography sx={{ color: tokens.muted, fontSize: 18, mb: 3 }}>
          Sign in with the details your family gave you.
        </Typography>

        <Box component="form" onSubmit={onElderSubmit} sx={{ display: 'grid', gap: 2 }}>
          <TextField label="Email" type="email" autoComplete="username" required
            value={email} onChange={(e) => setEmail(e.target.value)} sx={bigField} />
          <TextField label="Password" type="password" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)} sx={bigField} />
          <Button type="submit" variant="contained" size="large" disabled={busy}
            sx={{ fontSize: 22, py: 1.75, borderRadius: '14px' }}>
            Sign in
          </Button>
        </Box>

        <Divider sx={{ my: 3, color: tokens.muted }}>Family & carers</Divider>

        <Button fullWidth variant="outlined" disabled={busy}
          onClick={() => void run(() => signInWithPopup(auth, googleProvider))}>
          Continue with Google
        </Button>
      </Paper>
    </Box>
  )
}
