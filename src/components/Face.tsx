import { useId } from 'react'

/** Illustrated stand-ins for real photos. In production, contacts carry an uploaded photo URL. */
interface Person { bg: string; skin: string; hair: string; shirt: string; style: 'bun' | 'long' | 'short' | 'pony' | 'curly'; glasses?: boolean; beard?: boolean }

export const FACES: Record<string, Person> = {
  rose: { bg: '#F2E3F1', skin: '#F3CDB0', hair: '#DAD5CF', shirt: '#7A3E78', style: 'bun', glasses: true },
  emma: { bg: '#E9DDF2', skin: '#EDBE98', hair: '#7A4A2A', shirt: '#1E6B57', style: 'long' },
  tom: { bg: '#E2EAF7', skin: '#D9A27A', hair: '#2E2018', shirt: '#2B5AA3', style: 'short' },
  mia: { bg: '#E2EAF7', skin: '#C68A62', hair: '#1D1A16', shirt: '#2B5AA3', style: 'pony' },
  david: { bg: '#DDEEE6', skin: '#F0C8A8', hair: '#B8B2AA', shirt: '#4A7A3A', style: 'short', beard: true },
  lewis: { bg: '#FBEFD8', skin: '#8D5A3B', hair: '#1D1A16', shirt: '#FFFFFF', style: 'short' },
  alex: { bg: '#DDEEE6', skin: '#E6B08A', hair: '#5A3A22', shirt: '#9A5F0E', style: 'curly' },
  ben: { bg: '#FBEFD8', skin: '#F2CFB3', hair: '#C9A05A', shirt: '#B5552E', style: 'short' },
}

const PALETTE = ['#E9DDF2', '#E2EAF7', '#DDEEE6', '#FBEFD8', '#F2E3F1']

export function Face({ k, name, size = 48, className = '' }: { k?: string; name?: string; size?: number; className?: string }) {
  const id = useId()
  const p = k ? FACES[k] : undefined
  if (!p) {
    // Fallback: initials on a soft colour (for contacts without a photo).
    const initials = (name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
    const bg = PALETTE[(name || '').length % PALETTE.length]
    return (
      <span className={`face face-initials ${className}`} style={{ width: size, height: size, background: bg, fontSize: size * 0.38 }} aria-label={name}>
        {initials}
      </span>
    )
  }
  const back = p.style === 'long' ? <path d="M26 46C24 24 36 15 50 15S76 24 74 46L77 76C66 80 34 80 23 76Z" fill={p.hair} />
    : p.style === 'bun' ? <circle cx="50" cy="15" r="10" fill={p.hair} />
    : p.style === 'pony' ? <path d="M68 30C86 36 84 60 77 68C77 54 73 44 66 40Z" fill={p.hair} /> : null
  const front = p.style === 'curly'
    ? [[33, 32], [39, 24], [50, 20], [61, 24], [67, 32]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="8.5" fill={p.hair} />)
    : p.style === 'short' ? <path d="M30 41C28 22 40 17 50 17S72 22 70 41C66 30 58 26 50 27S34 30 30 41Z" fill={p.hair} />
    : <path d="M30 43C28 24 40 18 50 18S72 24 70 43C64 32 56 28 44 30S33 37 30 43Z" fill={p.hair} />
  return (
    <svg className={`face ${className}`} width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={name}>
      <defs><clipPath id={id}><circle cx="50" cy="50" r="50" /></clipPath></defs>
      <g clipPath={`url(#${id})`}>
        <rect width="100" height="100" fill={p.bg} />{back}
        <path d="M12 100C14 78 31 69 50 69S86 78 88 100Z" fill={p.shirt} {...(p.shirt === '#FFFFFF' ? { stroke: '#D9CFC0', strokeWidth: 1.5 } : {})} />
        <rect x="43" y="57" width="14" height="15" rx="5" fill={p.skin} />
        <ellipse cx="50" cy="42" rx="20" ry="23" fill={p.skin} />{front}
        {p.beard && <path d="M31 46C33 64 43 67 50 67S67 64 69 46C65 56 58 58 50 58S35 56 31 46Z" fill={p.hair} />}
        <circle cx="42" cy="44" r="2.3" fill="#2A211B" /><circle cx="58" cy="44" r="2.3" fill="#2A211B" />
        <circle cx="37" cy="51" r="3.2" fill="#E07A6A" opacity=".3" /><circle cx="63" cy="51" r="3.2" fill="#E07A6A" opacity=".3" />
        <path d="M42 53Q50 60 58 53" stroke={p.beard ? '#5A4A40' : '#8A4A3A'} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        {p.glasses && <g fill="none" stroke="#4A443C" strokeWidth="1.7"><circle cx="42" cy="44" r="6.5" /><circle cx="58" cy="44" r="6.5" /><path d="M48.5 44h3" /></g>}
      </g>
    </svg>
  )
}
