import { Box, ButtonBase } from '@mui/material'
import type { FamilyMessage } from '../lib/types'
import { tokens } from '../theme'

/**
 * Chips for the newest family message: message chips send their label, reminder chips run on the
 * server (once), call chips are a tap-to-call link. `size` = elder (big targets) or caretaker (compact).
 */
export function FamilyChips({ message, disabled, onSend, onRun, size }: {
  message: FamilyMessage
  disabled: boolean
  onSend: (text: string) => void
  onRun: (messageId: string, chip: number) => void
  size: 'elder' | 'caretaker'
}) {
  if (message.chips.length === 0) return null
  const big = size === 'elder'
  const base = {
    borderRadius: 999, fontWeight: 700, px: big ? 2 : 1.5, py: big ? 1.25 : 0.875, fontSize: big ? 18 : 14,
    '&.Mui-disabled': { opacity: 0.45 },
  } as const
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1, mb: 1 }}>
      {message.chips.map((chip, i) => {
        const used = message.usedChips.includes(i)
        if (chip.action?.type === 'call') {
          return (
            <ButtonBase key={i} component="a" href={`tel:${chip.action.phone.replace(/\s/g, '')}`} disabled={disabled}
              sx={{ ...base, bgcolor: tokens.accent, color: tokens.white }}>
              {chip.label}
            </ButtonBase>
          )
        }
        const isAction = chip.kind === 'action'
        return (
          <ButtonBase key={i} disabled={disabled || used}
            onClick={() => (isAction ? onRun(message.id, i) : onSend(chip.label))}
            sx={{
              ...base,
              border: `${big ? 2 : 1}px ${isAction ? 'dashed' : 'solid'} ${isAction ? tokens.amber : tokens.line}`,
              bgcolor: isAction ? tokens.amberSoft : tokens.white, color: tokens.ink,
              '&:hover': { borderColor: tokens.ink2 },
            }}>
            {used ? `✓ ${chip.label.replace(/^\S+\s/, '')}` : chip.label}
          </ButtonBase>
        )
      })}
    </Box>
  )
}

/** Small centred note for things that happened ("⏰ Reminder set for 10:30 — …"). */
export function SystemNote({ text, size }: { text: string; size: 'elder' | 'caretaker' }) {
  return (
    <Box sx={{ textAlign: 'center', my: 1.25 }}>
      <Box component="span" sx={{
        display: 'inline-block', bgcolor: tokens.amberSoft, color: tokens.amber, borderRadius: '12px',
        px: 1.5, py: 0.75, fontSize: size === 'elder' ? 17 : 13, fontWeight: 700, maxWidth: '100%',
      }}>
        {text}
      </Box>
    </Box>
  )
}
