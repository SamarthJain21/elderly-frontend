import { Box, ButtonBase, Typography } from '@mui/material'
import type { ActionCard, ActionStatus } from '../lib/types'
import { Pill } from './ui'
import { tokens } from '../theme'

const ICON: Record<string, string> = {
  order_food: '🍲', order_medicine: '💊', book_ride: '🚕', set_reminder: '⏰', send_message_to_caretaker: '💬',
}

const STATUS: Record<ActionStatus, { tone: 'ok' | 'warn' | 'bad' | 'info' | 'plum'; label: string }> = {
  awaiting_elder: { tone: 'warn', label: 'Waiting for you' },
  awaiting_caretaker: { tone: 'info', label: 'Asked your family' },
  done: { tone: 'ok', label: 'Done' },
  declined: { tone: 'plum', label: 'Family said no' },
  cancelled: { tone: 'plum', label: 'Cancelled' },
  blocked: { tone: 'bad', label: 'Not allowed' },
  failed: { tone: 'bad', label: "Didn't work" },
}

/** Order/booking card in the elder chat. Yes/No are big — prototype .bb.yes / .bb.no. */
export function ActionCardView({ card, onAnswer, disabled }: {
  card: ActionCard
  onAnswer?: (approve: boolean) => void
  disabled?: boolean
}) {
  const st = STATUS[card.status]
  return (
    <Box sx={{ bgcolor: tokens.white, border: `2px solid ${tokens.line}`, borderRadius: '20px', p: 2, mt: 1.25, maxWidth: 420 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1 }}>
        <Box sx={{ fontSize: 28 }}>{ICON[card.tool] ?? '✨'}</Box>
        <Typography sx={{ fontWeight: 700, fontSize: 19, flex: 1 }}>{card.title}</Typography>
        <Pill tone={st.tone}>{st.label}</Pill>
      </Box>
      {card.lines.map((l) => <Typography key={l} sx={{ fontSize: 18 }}>{l}</Typography>)}
      {(card.amount !== null || card.provider !== null) && (
        <Typography sx={{ fontSize: 17, color: tokens.ink2, mt: 0.75 }}>
          {[card.amount, card.provider, card.eta].filter(Boolean).join(' · ')}
        </Typography>
      )}
      {card.orderId !== null && <Typography sx={{ fontSize: 13, color: tokens.muted, mt: 0.5 }}>Order {card.orderId}</Typography>}
      {card.status === 'awaiting_elder' && onAnswer && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25, mt: 1.75 }}>
          <ButtonBase disabled={disabled} onClick={() => onAnswer(true)} sx={{
            minHeight: 64, borderRadius: '18px', fontSize: 21, fontWeight: 700, bgcolor: tokens.accent, color: tokens.white,
            '&.Mui-disabled': { opacity: 0.5 },
          }}>Yes</ButtonBase>
          <ButtonBase disabled={disabled} onClick={() => onAnswer(false)} sx={{
            minHeight: 64, borderRadius: '18px', fontSize: 21, fontWeight: 700, bgcolor: tokens.white, border: `2px solid ${tokens.line}`,
            '&.Mui-disabled': { opacity: 0.5 },
          }}>No</ButtonBase>
        </Box>
      )}
    </Box>
  )
}
