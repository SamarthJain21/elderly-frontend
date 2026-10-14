import { Alert, Box, CircularProgress, Typography } from '@mui/material'
import { useApi } from '../../lib/useApi'
import { MOOD_EMOJI, type CheckIn, type LogEntry, type TodayCheckIn } from '../../lib/types'
import { Card, Eyebrow, Pill, SectionTitle } from '../../components/ui'
import { tokens } from '../../theme'

const STATUS: Record<TodayCheckIn['status'], { tone: 'ok' | 'warn' | 'bad' | 'info' | 'plum'; label: string }> = {
  done: { tone: 'ok', label: 'Done' },
  in_progress: { tone: 'info', label: 'In progress' },
  due: { tone: 'warn', label: 'Waiting' },
  missed: { tone: 'bad', label: 'Missed' },
  upcoming: { tone: 'plum', label: 'Upcoming' },
  not_today: { tone: 'plum', label: 'No check-in today' },
}

const LOG_TONE = { ok: 'ok', warn: 'warn', alert: 'bad' } as const

function Facts({ c }: { c: CheckIn }) {
  const rows: [string, string][] = [
    ['Mood', c.mood ? `${MOOD_EMOJI[c.mood]} ${c.mood}` : '—'],
    ['Sleep', c.sleepQuality ? `${c.sleepQuality}${c.sleepHours !== null ? ` (~${c.sleepHours}h)` : ''}` : '—'],
    ['Meals', c.meals ?? '—'],
    ...(c.needsMedication ? [['Medicines', c.medicationTaken === null ? '—' : c.medicationTaken ? '✅ taken' : '❌ not taken'] as [string, string]] : []),
  ]
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, minmax(0,1fr))' }, gap: 2, mt: 1.5 }}>
      {rows.map(([k, v]) => (
        <Box key={k}>
          <Typography sx={{ fontSize: 13, color: tokens.muted }}>{k}</Typography>
          <Typography sx={{ fontWeight: 700 }}>{v}</Typography>
        </Box>
      ))}
    </Box>
  )
}

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export function CheckInSection({ elderId }: { elderId: string }) {
  const today = useApi<TodayCheckIn>(`/elders/${elderId}/checkins/today`)
  const week = useApi<CheckIn[]>(`/elders/${elderId}/checkins?days=7`)
  const logs = useApi<LogEntry[]>(`/elders/${elderId}/logs?limit=10`)
  const t = today.data

  return (
    <>
      <SectionTitle>Today's check-in</SectionTitle>
      <Card>
        {today.error !== null && <Alert severity="error">{today.error}</Alert>}
        {t === null && today.error === null && <CircularProgress size={22} />}
        {t !== null && (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Pill tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Pill>
              <Typography sx={{ color: tokens.muted, fontSize: 14 }}>scheduled {t.time}</Typography>
              {t.checkIn?.escalateFlag && <Pill tone="bad">Needs attention</Pill>}
            </Box>
            {t.checkIn !== null && <Facts c={t.checkIn} />}
            {t.checkIn !== null && t.checkIn.anomalies.length > 0 && (
              <Alert severity={t.checkIn.urgent.length > 0 ? 'error' : 'warning'} sx={{ mt: 2 }}>{t.checkIn.anomalies.join(' · ')}</Alert>
            )}
          </>
        )}
      </Card>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, mt: 2 }}>
        <Card>
          <Eyebrow>Last 7 days</Eyebrow>
          {week.data?.length === 0 && <Typography sx={{ color: tokens.muted, mt: 1 }}>No check-ins yet.</Typography>}
          {week.data?.map((c) => (
            <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, py: 1, '& + &': { borderTop: `1px solid ${tokens.line}` } }}>
              <Box sx={{ fontSize: 22, width: 28 }}>{c.mood ? MOOD_EMOJI[c.mood] : '·'}</Box>
              <Typography sx={{ fontWeight: 700, flex: 1 }}>{shortDate(c.date)}</Typography>
              {c.needsMedication && c.medicationTaken === false && <Pill tone="warn">Meds missed</Pill>}
              {c.escalateFlag && <Pill tone="bad">Alert</Pill>}
              {c.status === 'in_progress' && <Pill tone="info">Unfinished</Pill>}
            </Box>
          ))}
        </Card>
        <Card>
          <Eyebrow>Activity</Eyebrow>
          {logs.error !== null && <Alert severity="error" sx={{ mt: 1 }}>{logs.error}</Alert>}
          {logs.data?.length === 0 && <Typography sx={{ color: tokens.muted, mt: 1 }}>Nothing yet.</Typography>}
          {logs.data?.map((l) => (
            <Box key={l.id} sx={{ py: 1, '& + &': { borderTop: `1px solid ${tokens.line}` } }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.25 }}>
                <Pill tone={LOG_TONE[l.kind]}>{l.kind}</Pill>
                <Typography sx={{ fontSize: 13, color: tokens.muted }}>
                  {new Date(l.timestamp).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 15 }}>{l.message}</Typography>
            </Box>
          ))}
        </Card>
      </Box>
    </>
  )
}
