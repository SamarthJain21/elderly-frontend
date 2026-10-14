import { Box } from '@mui/material'
import { tokens } from '../theme'

export function Brand({ size = 22 }: { size?: number }) {
  const logo = Math.round(size * 1.55)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontFamily: 'Fraunces, serif', fontSize: size, fontWeight: 650 }}>
      <Box
        sx={{
          width: logo, height: logo, borderRadius: '11px', bgcolor: tokens.accent,
          display: 'grid', placeItems: 'center', color: tokens.white, fontSize: size * 0.82,
        }}
      >
        ♥
      </Box>
      Hearth
    </Box>
  )
}
