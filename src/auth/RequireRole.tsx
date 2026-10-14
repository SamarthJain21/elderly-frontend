import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { Box, CircularProgress, Typography } from '@mui/material'
import { homeFor, useAuth, type Role } from './AuthContext'

export function FullPageSpinner() {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <CircularProgress />
    </Box>
  )
}

/** Gate a route on auth state and role; redirects everyone else to where they belong. */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { state } = useAuth()
  switch (state.status) {
    case 'loading':
      return <FullPageSpinner />
    case 'signedOut':
      return <Navigate to="/login" replace />
    case 'needsOnboarding':
      return <Navigate to="/onboarding" replace />
    case 'error':
      return (
        <Box sx={{ p: 4 }}>
          <Typography color="error">{state.message}</Typography>
        </Box>
      )
    case 'ready':
      return state.me.role === role ? children : <Navigate to={homeFor(state.me.role)} replace />
    default: {
      const exhaustive: never = state
      return exhaustive
    }
  }
}
