import { useState } from 'react'
import { Alert, Box, Button, ButtonBase, CircularProgress, FormControlLabel, InputAdornment, Snackbar, Switch, TextField, Typography } from '@mui/material'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import { CURRENCY_SYMBOL, minorToInput, parseToMinor, type Currency } from '../../lib/money'
import type { AutonomyRules, Mode, ToolName } from '../../lib/types'
import { Card } from '../../components/ui'
import { useElder } from './elderContext'
import { tokens } from '../../theme'

// Labels and descriptions mirror the prototype's rule cards.
const TOOLS: { name: ToolName; icon: string; label: string; example: string }[] = [
  { name: 'order_medicine', icon: '💊', label: 'Order medicine', example: '“Order my blood pressure pills”' },
  { name: 'order_food', icon: '🍲', label: 'Order food & groceries', example: '“I’m hungry”, “I need milk and rice”' },
  { name: 'book_ride', icon: '🚕', label: 'Book a ride', example: '“Take me to the clinic”' },
  { name: 'notify_volunteer', icon: '🙋', label: 'Ask a volunteer for help', example: '“My tap is leaking”, “the light is broken”' },
  { name: 'send_message_to_caretaker', icon: '💬', label: 'Message you', example: '“Tell my son I’m fine”' },
  { name: 'set_reminder', icon: '⏰', label: 'Set reminders', example: '“Remind me to call the doctor at 4”' },
]

function modes(first: string): { value: Mode; label: string; sub: string }[] {
  return [
    { value: 'autonomous', label: 'Do it right away', sub: `Agent acts, then tells ${first}` },
    { value: 'elder_confirm', label: `Ask ${first} to confirm`, sub: '“Shall I…?” Yes / No' },
    { value: 'caretaker_approve', label: 'Ask me first', sub: 'You approve from your phone' },
    { value: 'blocked', label: 'Never — alert me', sub: 'Agent refuses, you follow up' },
  ]
}

function ModeSelector({ value, onChange, options }: { value: Mode; onChange: (m: Mode) => void; options: ReturnType<typeof modes> }) {
  return (
    <Box role="radiogroup" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 0.75 }}>
      {options.map((o) => {
        const on = o.value === value
        return (
          <ButtonBase key={o.value} role="radio" aria-checked={on} onClick={() => onChange(o.value)} sx={{
            display: 'block', textAlign: 'left', p: 1.25, borderRadius: '12px', fontSize: 14, fontWeight: 700, lineHeight: 1.2,
            border: `1.5px solid ${on ? tokens.ink : tokens.line}`, bgcolor: on ? tokens.ink : tokens.white, color: on ? tokens.white : tokens.ink,
          }}>
            {o.label}
            <Box component="small" sx={{ display: 'block', fontWeight: 400, fontSize: 12, opacity: 0.75, mt: 0.25 }}>{o.sub}</Box>
          </ButtonBase>
        )
      })}
    </Box>
  )
}

export function RulesPage() {
  const { elder } = useElder()
  const { data, error } = useApi<AutonomyRules>(`/elders/${elder.elderId}/rules`)
  if (error !== null) return <Alert severity="error">{error}</Alert>
  if (data === null) return <CircularProgress />
  return <RulesForm key={elder.elderId} elderId={elder.elderId} firstName={elder.name.split(' ')[0] ?? elder.name} initial={data} />
}

function RulesForm({ elderId, firstName, initial }: { elderId: string; firstName: string; initial: AutonomyRules }) {
  const [rules, setRules] = useState(initial)
  // Limit inputs are edited as text and parsed to integer minor units on save — never floats.
  const [limits, setLimits] = useState<Partial<Record<ToolName, string>>>(() =>
    Object.fromEntries(Object.entries(initial.tools).filter(([, r]) => r.limitMinor !== null).map(([k, r]) => [k, minorToInput(r.limitMinor ?? 0)])),
  )
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const currency = rules.currency as Currency
  const options = modes(firstName)

  const setMode = (name: ToolName, mode: Mode) =>
    setRules({ ...rules, tools: { ...rules.tools, [name]: { ...rules.tools[name], mode } } })

  const save = async () => {
    const tools = { ...rules.tools }
    for (const [name, text] of Object.entries(limits) as [ToolName, string][]) {
      const minor = parseToMinor(text)
      if (minor === null) {
        setError(`Enter a valid amount for “${TOOLS.find((t) => t.name === name)?.label}”, like 500 or 499.50.`)
        return
      }
      tools[name] = { ...tools[name], limitMinor: minor }
    }
    setError(null)
    setBusy(true)
    try {
      setRules(await api<AutonomyRules>(`/elders/${elderId}/rules`, { method: 'PUT', body: JSON.stringify({ ...rules, tools }) }))
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 2, mt: 2 }}>
      <Typography sx={{ color: tokens.ink2 }}>
        Decide what Elderly may do when {firstName} asks. Spending limits are per order, in {currency}.
      </Typography>

      <Card sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', bgcolor: tokens.sosSoft, borderColor: 'transparent' }}>
        <Box sx={{ width: 46, height: 46, borderRadius: '14px', bgcolor: tokens.white, display: 'grid', placeItems: 'center', fontSize: 24, flex: 'none' }}>🚑</Box>
        <Box>
          <Typography variant="h4" component="h2" sx={{ fontSize: 19 }}>Medical emergency — always immediate</Typography>
          <Typography sx={{ fontSize: 14, color: tokens.ink2, mt: 0.5 }}>
            “I fell”, “chest pain”, “I can’t breathe”. Emergencies can’t wait for approval, so this can’t be changed.
          </Typography>
        </Box>
      </Card>

      {TOOLS.map((t) => {
        const rule = rules.tools[t.name]
        const hasLimit = rule.limitMinor !== null
        return (
          <Card key={t.name} sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
            <Box sx={{ display: 'flex', gap: 1.75, alignItems: 'flex-start' }}>
              <Box sx={{ width: 46, height: 46, borderRadius: '14px', bgcolor: tokens.bg, display: 'grid', placeItems: 'center', fontSize: 24, flex: 'none' }}>{t.icon}</Box>
              <Box>
                <Typography variant="h4" component="h2" sx={{ fontSize: 19 }}>{t.label}</Typography>
                <Typography sx={{ fontSize: 14, color: tokens.muted, mt: 0.25 }}>{t.example}</Typography>
              </Box>
            </Box>
            <ModeSelector value={rule.mode} onChange={(m) => setMode(t.name, m)} options={options} />
            {hasLimit && rule.mode !== 'blocked' && (
              <TextField
                label="Limit per order" value={limits[t.name] ?? ''} sx={{ maxWidth: 260 }}
                onChange={(e) => setLimits({ ...limits, [t.name]: e.target.value })}
                helperText="Above this, Elderly always asks you first."
                slotProps={{
                  input: { startAdornment: <InputAdornment position="start">{CURRENCY_SYMBOL[currency]}</InputAdornment> },
                  htmlInput: { inputMode: 'decimal' },
                }}
              />
            )}
          </Card>
        )
      })}

      <Card>
        <FormControlLabel
          control={<Switch checked={rules.trustedVolunteersOnly} onChange={(e) => setRules({ ...rules, trustedVolunteersOnly: e.target.checked })} />}
          label="Only send volunteers I've marked as trusted"
        />
      </Card>

      {error !== null && <Alert severity="error">{error}</Alert>}
      <Box sx={{ position: 'sticky', bottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" size="large" disabled={busy} onClick={() => void save()}>Save rules</Button>
      </Box>
      <Snackbar open={saved} autoHideDuration={2500} onClose={() => setSaved(false)} message="Rules saved" />
    </Box>
  )
}
