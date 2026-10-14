// Small primitives matching the prototype's .card / .pill / .eyebrow / .chip / .av classes.
import type { ReactNode } from 'react'
import { Box, ButtonBase, Paper, Typography, type SxProps, type Theme } from '@mui/material'
import { tokens } from '../theme'

export function Card({ children, sx }: { children: ReactNode; sx?: SxProps<Theme> }) {
  return <Paper variant="outlined" sx={[{ p: '18px' }, ...(Array.isArray(sx) ? sx : [sx])]}>{children}</Paper>
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <Typography component="div" sx={{ fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700, color: tokens.muted }}>
      {children}
    </Typography>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mt: 3, mb: 1.25 }}>
      <Typography variant="h3" component="h2" sx={{ fontSize: 22 }}>{children}</Typography>
      {action}
    </Box>
  )
}

const PILL = {
  ok: [tokens.accentSoft, tokens.accent],
  bad: [tokens.sosSoft, tokens.sos],
  warn: [tokens.amberSoft, tokens.amber],
  info: [tokens.blueSoft, tokens.blue],
  plum: [tokens.plumSoft, tokens.plum],
} as const

export function Pill({ tone, children }: { tone: keyof typeof PILL; children: ReactNode }) {
  const [bg, fg] = PILL[tone]
  return (
    <Box component="span" sx={{
      display: 'inline-block', px: 1.25, py: 0.5, borderRadius: 999, fontSize: 13, fontWeight: 700, bgcolor: bg, color: fg,
      whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'middle',
    }}>
      {children}
    </Box>
  )
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={on}
      sx={{
        border: `1px solid ${on ? tokens.ink : tokens.line}`, bgcolor: on ? tokens.ink : tokens.white,
        color: on ? tokens.white : tokens.ink, borderRadius: 999, px: 1.5, py: 0.875, fontSize: 14, fontWeight: 700,
        '&:hover': { borderColor: tokens.ink2 },
      }}
    >
      {children}
    </ButtonBase>
  )
}

const AV_TONES = [[tokens.plumSoft, tokens.plum], [tokens.accentSoft, tokens.accent], [tokens.blueSoft, tokens.blue], [tokens.amberSoft, tokens.amber]] as const

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
  const [bg, fg] = AV_TONES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_TONES.length]
  return (
    <Box sx={{ width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 700, bgcolor: bg, color: fg, flex: 'none', fontSize: size * 0.4 }}>
      {initials || '?'}
    </Box>
  )
}
