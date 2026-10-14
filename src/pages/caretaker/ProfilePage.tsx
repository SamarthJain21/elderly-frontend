import { useState } from 'react'
import { Alert, Box, Button, ButtonBase, CircularProgress, IconButton, MenuItem, Snackbar, TextField, Typography } from '@mui/material'
import { api } from '../../lib/api'
import { useApi } from '../../lib/useApi'
import type { Address, EmergencyContact, Language, Profile, SharingTier } from '../../lib/types'
import { Card, Eyebrow } from '../../components/ui'
import { useElder } from './elderContext'
import { useCaretaker } from './caretakerContext'
import { CaretakersCard } from './CaretakersCard'
import { tokens } from '../../theme'

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en-US', label: 'English' },
  { value: 'hi-IN', label: 'हिन्दी (Hindi)' },
  { value: 'th-TH', label: 'ไทย (Thai)' },
]

const TIERS: { value: SharingTier; label: string; sub: string }[] = [
  { value: 'alerts_only', label: 'Alerts only', sub: 'You only see urgent alerts. Most private.' },
  { value: 'daily_summary', label: 'Daily summary', sub: 'Check-in results and activity, not conversations.' },
  { value: 'full_access', label: 'Full access', sub: 'Everything, including chats with Elderly.' },
]

export function ProfilePage() {
  const { elder } = useElder()
  const { data, error } = useApi<Profile>(`/elders/${elder.elderId}/profile`)
  if (error !== null) return <Alert severity="error">{error}</Alert>
  if (data === null) return <CircularProgress />
  return <ProfileForm key={elder.elderId} elderId={elder.elderId} initial={data} />
}

function ProfileForm({ elderId, initial }: { elderId: string; initial: Profile }) {
  const { reloadElder } = useElder()
  const { reloadElders } = useCaretaker()
  const [p, setP] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const addr: Address = p.address ?? { line1: '', line2: '', landmark: '', city: '', postcode: '', lat: null, lng: null, precision: null }
  const setAddr = (patch: Partial<Address>) => setP({ ...p, address: { ...addr, ...patch } })

  const setContact = (i: number, patch: Partial<EmergencyContact>) =>
    setP({ ...p, emergencyContacts: p.emergencyContacts.map((c, j) => (j === i ? { ...c, ...patch } : c)) })

  const save = async () => {
    const contacts = p.emergencyContacts.map((c) => ({ ...c, name: c.name.trim(), phone: c.phone.trim() }))
    if (contacts.some((c) => c.name === '' || c.phone.length < 5)) {
      setError('Each emergency contact needs a name and phone number.')
      return
    }
    const address = p.address === null || (addr.line1.trim() === '' && addr.city.trim() === '')
      ? null
      : { ...addr, line1: addr.line1.trim(), city: addr.city.trim() }
    if (address !== null && (address.line1 === '' || address.city === '')) {
      setError('The address needs at least a street and a town or city.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      setP(await api<Profile>(`/elders/${elderId}/profile`, {
        method: 'PUT', body: JSON.stringify({ ...p, name: p.name.trim(), phone: p.phone.trim(), address, emergencyContacts: contacts }),
      }))
      setSaved(true)
      reloadElder()
      reloadElders()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr)', gap: 2, mt: 2, maxWidth: 720 }}>
      <Card sx={{ display: 'grid', gap: 2 }}>
        <Eyebrow>About them</Eyebrow>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <TextField label="Name" required value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
          <TextField label="Phone" required type="tel" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} />
        </Box>
        <TextField select label="Language Elderly speaks with them" value={p.language} onChange={(e) => setP({ ...p, language: e.target.value as Language })}>
          {LANGUAGES.map((l) => <MenuItem key={l.value} value={l.value}>{l.label}</MenuItem>)}
        </TextField>
      </Card>

      <Card sx={{ display: 'grid', gap: 2 }}>
        <Eyebrow>Home address</Eyebrow>
        <Typography sx={{ fontSize: 13, color: tokens.muted, mt: -1 }}>For deliveries, ride pickup and local weather.</Typography>
        <TextField label="House / flat, street" value={addr.line1} onChange={(e) => setAddr({ line1: e.target.value })} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <TextField label="Area (optional)" value={addr.line2} onChange={(e) => setAddr({ line2: e.target.value })} />
          <TextField label="Landmark (optional)" placeholder="Near the temple" value={addr.landmark} onChange={(e) => setAddr({ landmark: e.target.value })} />
          <TextField label="Town or city" value={addr.city} onChange={(e) => setAddr({ city: e.target.value })} />
          <TextField label="PIN / postcode" value={addr.postcode} onChange={(e) => setAddr({ postcode: e.target.value })} />
        </Box>
        {p.address !== null && (p.address.precision === null || p.address.precision === 'city') && p.address.line1 !== '' && (
          <Alert severity="warning">
            {p.address.precision === 'city'
              ? "We could only find the town on the map, not the street — rides will pick up from the phone's location instead."
              : "We couldn't find this address on the map, so ride pickup won't be prefilled. Check the street and city."}
          </Alert>
        )}
      </Card>

      <Card sx={{ display: 'grid', gap: 1.5 }}>
        <Eyebrow>What you can see</Eyebrow>
        <Box role="radiogroup" sx={{ display: 'grid', gap: 1 }}>
          {TIERS.map((t) => {
            const on = p.sharingTier === t.value
            return (
              <ButtonBase key={t.value} role="radio" aria-checked={on} onClick={() => setP({ ...p, sharingTier: t.value })} sx={{
                display: 'block', textAlign: 'left', p: 1.5, borderRadius: '12px',
                border: `1.5px solid ${on ? tokens.ink : tokens.line}`, bgcolor: on ? tokens.ink : tokens.white, color: on ? tokens.white : tokens.ink,
              }}>
                <Typography sx={{ fontWeight: 700 }}>{t.label}</Typography>
                <Typography sx={{ fontSize: 13, opacity: 0.75 }}>{t.sub}</Typography>
              </ButtonBase>
            )
          })}
        </Box>
        <Typography sx={{ fontSize: 13, color: tokens.muted }}>Agree this with them — it's their privacy.</Typography>
      </Card>

      <Card sx={{ display: 'grid', gap: 2 }}>
        <Eyebrow>Emergency contacts</Eyebrow>
        {p.emergencyContacts.length === 0 && <Typography sx={{ color: tokens.muted }}>None yet. Add a neighbour or relative who lives nearby.</Typography>}
        {p.emergencyContacts.map((c, i) => (
          <Box key={i} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1.2fr 1fr 1fr auto' }, gap: 1.5, alignItems: 'center' }}>
            <TextField label="Name" value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} />
            <TextField label="Phone" type="tel" value={c.phone} onChange={(e) => setContact(i, { phone: e.target.value })} />
            <TextField label="Relationship" placeholder="Neighbour" value={c.relationship} onChange={(e) => setContact(i, { relationship: e.target.value })} />
            <IconButton aria-label={`Remove ${c.name || 'contact'}`} onClick={() => setP({ ...p, emergencyContacts: p.emergencyContacts.filter((_, j) => j !== i) })}>×</IconButton>
          </Box>
        ))}
        {p.emergencyContacts.length < 10 && (
          <Box>
            <Button variant="outlined" onClick={() => setP({ ...p, emergencyContacts: [...p.emergencyContacts, { name: '', phone: '', relationship: '' }] })}>
              + Add contact
            </Button>
          </Box>
        )}
      </Card>

      {error !== null && <Alert severity="error">{error}</Alert>}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" size="large" disabled={busy || p.name.trim() === ''} onClick={() => void save()}>Save profile</Button>
      </Box>

      <CaretakersCard elderId={elderId} firstName={p.name.split(' ')[0] ?? p.name} />
      <Snackbar open={saved} autoHideDuration={2500} onClose={() => setSaved(false)} message="Profile saved" />
    </Box>
  )
}
