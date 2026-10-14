import { useEffect, useState } from 'react'
import { Alert, Box, CircularProgress, Typography } from '@mui/material'
import { TopBar } from '../../components/TopBar'
import { useAuth } from '../../auth/AuthContext'
import { useApi } from '../../lib/useApi'
import { REMINDER_ICON, type ElderProfile, type TodayReminders } from '../../lib/types'
import { tokens } from '../../theme'

/** "HH:MM" right now in the elder's timezone — the device clock may be set elsewhere. */
function nowHHMM(tz: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(new Date())
}

function greeting(hhmm: string): string {
  const h = Number(hhmm.slice(0, 2))
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function useClock(tz: string | null): string | null {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])
  return tz === null ? null : nowHHMM(tz)
}

export function ElderHome() {
  const { state } = useAuth()
  const elderId = state.status === 'ready' ? state.me.uid : null
  const profile = useApi<ElderProfile>(elderId && `/elders/${elderId}`)
  const assessed = profile.data?.assessment != null
  const today = useApi<TodayReminders>(elderId && assessed ? `/elders/${elderId}/reminders/today` : null)
  const tz = today.data?.timezone ?? null
  const now = useClock(tz)

  const firstName = profile.data?.name.split(' ')[0] ?? ''
  const dateLabel = today.data
    ? new Date(`${today.data.date}T12:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
    : ''

  return (
    <>
      <TopBar />
      <Box sx={{ maxWidth: 560, mx: 'auto', px: 2.5, py: 2 }}>
        {profile.error !== null && <Alert severity="error">{profile.error}</Alert>}
        {profile.data === null ? <CircularProgress /> : (
          <>
            <Typography sx={{ fontSize: 17, color: tokens.ink2, mt: 0.75 }}>{dateLabel}</Typography>
            <Typography variant="h1" sx={{ fontSize: 34, lineHeight: 1.1, mt: 0.75, mb: 2 }}>
              {now ? greeting(now) : 'Hello'}, {firstName}
            </Typography>

            {!assessed ? (
              <Box sx={{ bgcolor: tokens.blueSoft, color: tokens.blue, borderRadius: '20px', p: '16px 18px', fontSize: 19, fontWeight: 700 }}>
                Your family is setting things up for you. 💙
              </Box>
            ) : (
              <>
                <Typography variant="h2" sx={{ fontSize: 24, mb: 1.5 }}>Today</Typography>
                {today.error !== null && <Alert severity="error">{today.error}</Alert>}
                {today.data === null && today.error === null && <CircularProgress />}
                {today.data?.reminders.length === 0 && (
                  <Box sx={{ bgcolor: tokens.accentSoft, color: tokens.accent, borderRadius: '20px', p: '14px 16px', fontSize: 18, fontWeight: 700 }}>
                    Nothing planned today. Enjoy your day! 🌿
                  </Box>
                )}
                <Box sx={{ display: 'grid', gap: 1.5 }}>
                  {today.data?.reminders.map((r) => {
                    const past = now !== null && r.time < now
                    return (
                      <Box key={r.id} sx={{
                        display: 'flex', alignItems: 'center', gap: 2, p: 2, borderRadius: '24px',
                        border: `2px solid ${tokens.line}`, bgcolor: tokens.white, opacity: past ? 0.55 : 1,
                      }}>
                        <Box sx={{ fontSize: 34, lineHeight: 1 }}>{REMINDER_ICON[r.kind]}</Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontSize: 20, fontWeight: 700, lineHeight: 1.25 }}>{r.title}</Typography>
                          <Typography sx={{ fontSize: 17, color: tokens.ink2 }}>{r.time}</Typography>
                        </Box>
                      </Box>
                    )
                  })}
                </Box>
              </>
            )}
          </>
        )}
      </Box>
    </>
  )
}
