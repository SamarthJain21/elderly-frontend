import { Box, Typography } from '@mui/material'
import { TopBar } from '../components/TopBar'

// Placeholder: real elder UI (check-in card, mic, tiles) follows the prototype.
export function ElderHome() {
  return (
    <>
      <TopBar />
      <Box sx={{ maxWidth: 720, mx: 'auto', p: 3 }}>
        <Typography variant="h3" component="h1">Good to see you</Typography>
      </Box>
    </>
  )
}
