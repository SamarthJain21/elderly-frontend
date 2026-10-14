import { Box, Button } from '@mui/material'
import { useAuth } from '../auth/AuthContext'
import { Brand } from './Brand'
import { tokens } from '../theme'

export function TopBar() {
  const { signOut } = useAuth()
  return (
    <Box
      component="header"
      sx={{
        position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center', gap: 2,
        px: { xs: 2, sm: 3 }, py: 1.5, bgcolor: 'rgba(245,239,230,.94)', backdropFilter: 'blur(8px)',
        borderBottom: `1px solid ${tokens.line}`,
      }}
    >
      <Brand />
      <Box sx={{ flex: 1 }} />
      <Button variant="outlined" size="small" onClick={() => void signOut()}>Sign out</Button>
    </Box>
  )
}
