import { useNavigate } from 'react-router'
import { Box, ButtonBase, Typography } from '@mui/material'
import { MOOD_EMOJI, type Mood, type TodayCheckIn } from '../../lib/types'
import { tokens } from '../../theme'

// Prototype faces: Good / Okay / Not good. "Not good" maps to `low`; the chat can escalate to `bad`.
const FACES: { mood: Mood; emoji: string; label: string }[] = [
  { mood: 'good', emoji: '😊', label: 'Good' },
  { mood: 'okay', emoji: '😐', label: 'Okay' },
  { mood: 'low', emoji: '😟', label: 'Not good' },
]

function partOfDay(hhmm: string | null): string {
  const h = hhmm === null ? 12 : Number(hhmm.slice(0, 2))
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'
}

export function CheckInCard({ today, now }: { today: TodayCheckIn; now: string | null }) {
  const navigate = useNavigate()
  const go = (param: string) => void navigate(`/elder/chat?checkin=${param}`)

  if (today.status === 'done') {
    const mood = today.checkIn?.mood
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, bgcolor: tokens.accentSoft, color: tokens.accent, borderRadius: '20px', p: '14px 16px', fontSize: 18, fontWeight: 700, mb: 2 }}>
        ✓ Checked in — thank you! {mood ? MOOD_EMOJI[mood] : '💚'}
      </Box>
    )
  }

  if (today.status === 'in_progress') {
    return (
      <ButtonBase onClick={() => go('resume')} sx={{ width: '100%', justifyContent: 'space-between', bgcolor: tokens.amberSoft, borderRadius: '24px', p: 2.25, mb: 2, fontSize: 20, fontWeight: 700, textAlign: 'left' }}>
        Let's finish your check-in
        <Box component="span" sx={{ fontSize: 26 }}>›</Box>
      </ButtonBase>
    )
  }

  if (today.status === 'due' || today.status === 'missed') {
    return (
      <Box sx={{ bgcolor: tokens.amberSoft, borderRadius: '24px', p: 2.25, mb: 2 }}>
        <Typography sx={{ fontSize: 21, fontWeight: 700, mb: 1.5 }}>How are you feeling this {partOfDay(now)}?</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
          {FACES.map((f) => (
            <ButtonBase key={f.mood} onClick={() => go(f.mood)} sx={{
              bgcolor: tokens.white, border: '2px solid transparent', borderRadius: '18px', py: 1.25, px: 0.5,
              fontSize: 16, fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25,
              '&:hover': { borderColor: tokens.amber },
            }}>
              <Box component="span" sx={{ fontSize: 36, lineHeight: 1.1 }}>{f.emoji}</Box>
              {f.label}
            </ButtonBase>
          ))}
        </Box>
      </Box>
    )
  }

  if (today.status === 'upcoming') {
    return (
      <Box sx={{ bgcolor: tokens.blueSoft, color: tokens.blue, borderRadius: '20px', p: '14px 16px', fontSize: 18, fontWeight: 700, mb: 2 }}>
        I'll check in with you at {today.time} 🌼
      </Box>
    )
  }
  return null // not_today
}
