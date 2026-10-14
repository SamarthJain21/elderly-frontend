import { Link, NavLink, Outlet, useParams } from 'react-router'
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material'
import { useApi } from '../../lib/useApi'
import type { ElderProfile } from '../../lib/types'
import { Avatar } from '../../components/ui'
import type { ElderOutlet } from './elderContext'
import { tokens } from '../../theme'

const TABS = [
  { to: '', label: 'Overview', end: true },
  { to: 'rules', label: 'Rules & limits', end: false },
  { to: 'profile', label: 'Profile', end: false },
]

const tabSx = {
  px: 1.75, py: 1, borderRadius: 999, fontWeight: 700, color: tokens.ink2, textDecoration: 'none', whiteSpace: 'nowrap',
  '&:hover': { bgcolor: tokens.bg },
  '&.active': { bgcolor: tokens.ink, color: tokens.white },
} as const

export function ElderShell() {
  const { elderId = '' } = useParams()
  const { data: elder, error, reload } = useApi<ElderProfile>(`/elders/${elderId}`)

  if (error !== null) return <Alert severity="error">{error}</Alert>
  if (elder === null) return <CircularProgress />

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Avatar name={elder.name} size={56} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h3" component="h1" sx={{ fontSize: 30 }}>{elder.name}</Typography>
          <Typography sx={{ color: tokens.muted }}>{elder.phone}</Typography>
        </Box>
        {elder.assessment !== null && (
          <Button variant="outlined" component={Link} to={`/caretaker/elders/${elderId}/assessment`}>Edit assessment</Button>
        )}
      </Box>
      <Box component="nav" sx={{
        display: 'flex', gap: 0.5, mt: 2.5, mb: 1, p: 0.5, bgcolor: tokens.paper, border: `1px solid ${tokens.line}`,
        borderRadius: 999, width: 'fit-content', maxWidth: '100%', overflowX: 'auto',
      }}>
        {TABS.map((t) => (
          <Box key={t.label} component={NavLink} to={`/caretaker/elders/${elderId}/${t.to}`} end={t.end} sx={tabSx}>{t.label}</Box>
        ))}
      </Box>
      <Outlet context={{ elder, reloadElder: reload } satisfies ElderOutlet} />
    </Box>
  )
}
