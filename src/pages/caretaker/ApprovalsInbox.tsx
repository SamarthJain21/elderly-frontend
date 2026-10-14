import { Box, Typography } from '@mui/material'
import { useApi } from '../../lib/useApi'
import type { Approval } from '../../lib/types'
import { Card, Pill } from '../../components/ui'
import { tokens } from '../../theme'

/** Requests waiting on the caretaker. Empty until the agent's tools land; then approve/decline here. */
export function ApprovalsInbox({ elderId }: { elderId: string }) {
  const { data } = useApi<Approval[]>(`/elders/${elderId}/approvals`)
  if (data === null || data.length === 0) return null
  return (
    <Card sx={{ mt: 2, bgcolor: tokens.amberSoft, borderColor: 'transparent' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="h4" component="h2" sx={{ fontSize: 20 }}>Waiting for you</Typography>
        <Pill tone="warn">{data.length}</Pill>
      </Box>
      {data.map((a) => (
        <Typography key={a.id} sx={{ py: 0.75 }}>“{a.elderRequestText}”</Typography>
      ))}
    </Card>
  )
}
