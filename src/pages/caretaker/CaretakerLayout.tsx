import { Link, NavLink, Outlet } from 'react-router'
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material'
import { TopBar } from '../../components/TopBar'
import { Avatar, Eyebrow, Pill } from '../../components/ui'
import { useApi } from '../../lib/useApi'
import type { ElderSummary } from '../../lib/types'
import { useCaretaker, type CaretakerOutlet } from './caretakerContext'
import { tokens } from '../../theme'


const navSx = {
  display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1.25, borderRadius: '12px',
  fontWeight: 700, color: tokens.ink2, textDecoration: 'none', whiteSpace: 'nowrap',
  '&:hover': { bgcolor: tokens.bg },
  '&.active': { bgcolor: tokens.ink, color: tokens.white },
} as const

export function CaretakerLayout() {
  const { data: elders, error, loading, reload } = useApi<ElderSummary[]>('/elders')

  return (
    <>
      <TopBar />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '248px minmax(0,1fr)' }, minHeight: 'calc(100dvh - 61px)' }}>
        <Box component="nav" sx={{
          borderRight: { md: `1px solid ${tokens.line}` }, borderBottom: { xs: `1px solid ${tokens.line}`, md: 0 },
          p: { xs: 1.5, md: '22px 14px' }, bgcolor: tokens.paper,
        }}>
          <Box sx={{ display: { xs: 'none', md: 'block' }, px: 1.25, pb: 1.5 }}><Eyebrow>People you care for</Eyebrow></Box>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'row', md: 'column' }, gap: 0.5, overflowX: 'auto' }}>
            {loading && elders === null && <CircularProgress size={20} sx={{ m: 1.5 }} />}
            {elders?.map((e) => (
              <Box key={e.elderId} component={NavLink} to={`/caretaker/elders/${e.elderId}`} sx={navSx}>
                <Avatar name={e.name} size={30} />
                <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</Box>
                {!e.assessed && <Box sx={{ ml: 'auto', width: 8, height: 8, borderRadius: '50%', bgcolor: tokens.amber, flex: 'none' }} title="Assessment needed" />}
              </Box>
            ))}
            <Box component={NavLink} to="/caretaker/add" sx={navSx}>
              <Box sx={{ width: 30, height: 30, borderRadius: '50%', border: `1.5px dashed ${tokens.muted}`, display: 'grid', placeItems: 'center' }}>+</Box>
              Add person
            </Box>
          </Box>
        </Box>
        <Box component="main" sx={{ p: { xs: 2, sm: '28px 32px 60px' }, maxWidth: 1180, width: '100%' }}>
          {error !== null ? (
            <Alert severity="error" action={<Button onClick={reload}>Retry</Button>}>{error}</Alert>
          ) : elders === null ? (
            <CircularProgress />
          ) : (
            <Outlet context={{ elders, reloadElders: reload } satisfies CaretakerOutlet} />
          )}
        </Box>
      </Box>
    </>
  )
}

export function CaretakerIndex() {
  const { elders } = useCaretaker()
  const first = elders[0]
  if (first === undefined) {
    return (
      <Box sx={{ maxWidth: 520 }}>
        <Typography variant="h3" component="h1" sx={{ fontSize: 30, mb: 1 }}>Welcome to Elderly</Typography>
        <Typography sx={{ color: tokens.muted, mb: 3 }}>
          Start by adding the person you care for. You'll set up their routine and medicines next.
        </Typography>
        <Button variant="contained" component={Link} to="/caretaker/add">Add person</Button>
      </Box>
    )
  }
  return (
    <Box>
      <Typography variant="h3" component="h1" sx={{ fontSize: 30, mb: 2 }}>Today</Typography>
      <Box sx={{ display: 'grid', gap: 1 }}>
        {elders.map((e) => (
          <Box key={e.elderId} component={Link} to={`/caretaker/elders/${e.elderId}`} sx={{
            display: 'flex', alignItems: 'center', gap: 1.25, p: 1.5, borderRadius: '14px', bgcolor: tokens.paper,
            border: `1px solid ${tokens.line}`, color: tokens.ink, textDecoration: 'none', minWidth: 0,
          }}>
            <Avatar name={e.name} size={34} />
            <Box sx={{ flex: 1, minWidth: 0, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</Box>
            <Pill tone={e.assessed ? 'ok' : 'warn'}>{e.assessed ? 'Set up' : 'Needs assessment'}</Pill>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
