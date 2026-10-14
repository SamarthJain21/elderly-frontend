import { useState } from 'react'
import { Alert, Box, Button, Typography } from '@mui/material'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { formatMinor } from '../../lib/money'
import type { Action } from '../../lib/types'
import { Card, Pill } from '../../components/ui'
import { tokens } from '../../theme'

const ICON: Record<string, string> = {
  order_food: '🍲', order_medicine: '💊', book_ride: '🚕', set_reminder: '⏰', send_message_to_caretaker: '💬',
}

function describe(a: Action): string {
  if (a.quote) return a.quote.lines.join(', ')
  const detail = a.args.title ?? a.args.message ?? a.args.destination
  return typeof detail === 'string' ? detail : a.tool.replace(/_/g, ' ')
}

/** Requests waiting on the caretaker. Approve → the order is placed and the elder is told in chat. */
export function ApprovalsInbox({ elderId, firstName }: { elderId: string; firstName: string }) {
  const { data, reload } = useApi<Action[]>(`/elders/${elderId}/approvals`)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (data === null || data.length === 0) return null

  const decide = async (a: Action, approve: boolean) => {
    setBusy(a.id)
    setError(null)
    try {
      await api(`/elders/${elderId}/actions/${a.id}/decide`, { method: 'POST', body: JSON.stringify({ approve }) })
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your decision')
      reload()
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card sx={{ mt: 2, bgcolor: tokens.amberSoft, borderColor: 'transparent' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="h4" component="h2" sx={{ fontSize: 20 }}>Waiting for you</Typography>
        <Pill tone="warn">{data.length}</Pill>
      </Box>
      {error !== null && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {data.map((a) => (
        <Box key={a.id} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', py: 1.25, '& + &': { borderTop: `1px solid rgba(0,0,0,.08)` } }}>
          <Box sx={{ width: 40, height: 40, borderRadius: '12px', bgcolor: tokens.white, display: 'grid', placeItems: 'center', fontSize: 20, flex: 'none' }}>
            {ICON[a.tool] ?? '✨'}
          </Box>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography sx={{ fontWeight: 700 }}>
              {describe(a)}
              {a.quote && <> · {formatMinor(a.quote.amountMinor, a.quote.currency)}</>}
            </Typography>
            <Typography sx={{ fontSize: 13, color: tokens.ink2 }}>
              {a.requestText ? `${firstName} said “${a.requestText}”` : ''}
              {a.quote ? ` · ${a.quote.provider}` : ''}
              {a.quote?.demo ? ' · demo order' : ''}
              {a.quote?.estimate ? ' · fare estimate' : ''}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" disabled={busy !== null} onClick={() => void decide(a, false)}>Decline</Button>
            <Button variant="contained" disabled={busy !== null} onClick={() => void decide(a, true)}>
              {busy === a.id ? 'Saving…' : 'Approve'}
            </Button>
          </Box>
        </Box>
      ))}
    </Card>
  )
}
