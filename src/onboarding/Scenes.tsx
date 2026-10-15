/**
 * Small animated illustrations for each onboarding step. SVG + SMIL/CSS only (no libraries).
 * Everything goes still when the user prefers reduced motion.
 */
import type { ReactNode } from 'react'
import { Face } from '../components/Face'

const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches


// ---------- Welcome: two faces with a floating heart ----------
export function WelcomeScene() {
  return (
    <div className="scene scene-welcome" aria-hidden>
      <div className="bob"><Face k="rose" size={104} /></div>
      <svg className="float-heart" width="44" height="44" viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.4 3.3 5 6.6 5c2 0 3.4 1.1 4.4 2.5C12 6.1 13.4 5 15.4 5 18.7 5 21 8.4 19.5 11.8 17.5 16.4 12 21 12 21z" fill="#C2362B" /></svg>
      <div className="bob delay"><Face k="emma" size={84} /></div>
    </div>
  )
}

// ---------- Sign in: shield that draws its tick ----------
export function ShieldScene() {
  return (
    <div className="scene" aria-hidden>
      <svg width="120" height="130" viewBox="0 0 120 130">
        <path d="M60 8 104 24v36c0 30-19 52-44 62C35 112 16 90 16 60V24z" fill="#DDEEE6" stroke="#1E6B57" strokeWidth="5" strokeLinejoin="round" />
        <path className="draw" d="M40 66l14 14 28-30" fill="none" stroke="#1E6B57" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

// ---------- About them: a home with a glowing window ----------
export function HomeScene({ faceKey }: { faceKey?: string }) {
  return (
    <div className="scene scene-home" aria-hidden>
      <svg width="200" height="130" viewBox="0 0 200 130">
        <rect x="0" y="112" width="200" height="18" rx="9" fill="#DDEEE6" />
        <path d="M40 60 100 18l60 42v56H40z" fill="#FFFCF7" stroke="#4A443C" strokeWidth="3" strokeLinejoin="round" />
        <path d="M30 64 100 12l70 52" fill="none" stroke="#7A3E78" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <rect className="glow" x="58" y="66" width="30" height="26" rx="4" fill="#F7C873" />
        <rect x="112" y="76" width="26" height="40" rx="4" fill="#9A5F0E" />
        <circle cx="132" cy="97" r="2" fill="#FBEFD8" />
        <path className="puff" d="M150 30c0-6 8-6 8 0 0-6 8-6 8 0" fill="none" stroke="#CFC6B8" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {faceKey && <div className="home-face"><Face k={faceKey} size={56} /></div>}
    </div>
  )
}

// ---------- Daily rhythm: a calm sky banner — dawn → day → dusk → night, sun then moon arc over the hills ----------
export function SkyScene() {
  const dur = '16s'
  // Arc stays well inside the rounded corners; the hills hide the sun/moon as they rise and set.
  const arc = 'M48,112 Q160,-4 272,112'
  return (
    <div className="scene-sky" aria-hidden>
      <svg viewBox="0 0 320 120" preserveAspectRatio="xMidYMid slice" width="100%" height="120">
        <rect width="320" height="120" fill="#BFE3F5">
          {!reduced && <animate attributeName="fill" dur={dur} repeatCount="indefinite"
            values="#F9D3B0;#BFE3F5;#BFE3F5;#F5B08E;#2A3658;#2A3658;#F9D3B0" keyTimes="0;0.1;0.4;0.5;0.58;0.94;1" />}
        </rect>
        <g fill="#fff" opacity="0">
          {!reduced && <animate attributeName="opacity" dur={dur} repeatCount="indefinite" values="0;0;0.9;0.9;0" keyTimes="0;0.55;0.62;0.9;1" />}
          {[[70, 26], [118, 14], [200, 20], [250, 34], [160, 40]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 2 ? 1.3 : 1.8} />)}
        </g>
        <g>
          <circle r="22" fill="#F7B733" opacity=".22" /><circle r="14" fill="#F7B733" />
          {!reduced ? <>
            <animateMotion dur={dur} repeatCount="indefinite" path={arc} keyPoints="0;1;1" keyTimes="0;0.5;1" calcMode="linear" />
            <animate attributeName="opacity" dur={dur} repeatCount="indefinite" values="1;1;0;0" keyTimes="0;0.5;0.501;1" />
          </> : <animateMotion dur="1s" fill="freeze" path={arc} keyPoints="0.5;0.5" keyTimes="0;1" calcMode="linear" />}
        </g>
        {!reduced && (
          <g opacity="0">
            {/* a real crescent shape — no dark overlay disc */}
            <path d="M2,-12 A12,12 0 1,0 2,12 A9,11 0 1,1 2,-12z" fill="#F4F1E8" />
            <animateMotion dur={dur} repeatCount="indefinite" path={arc} keyPoints="0;0;1" keyTimes="0;0.5;1" calcMode="linear" />
            <animate attributeName="opacity" dur={dur} repeatCount="indefinite" values="0;0;1;1" keyTimes="0;0.5;0.501;1" />
          </g>
        )}
        <path d="M0 104 Q60 88 120 100 T240 96 T320 102 V120 H0z" fill="#7FB89A" />
        <path d="M0 112 Q80 100 160 110 T320 108 V120 H0z" fill="#5E9C7E" />
      </svg>
    </div>
  )
}

// ---------- Medicines: bottle tips pills into a weekly organiser ----------
export function PillScene({ count }: { count: number }) {
  // Extra room in the viewBox so the tipping bottle never gets clipped.
  return (
    <div className="scene scene-pills" aria-hidden>
      <svg width="260" height="160" viewBox="-10 -14 260 160" overflow="visible">
        <g className="bottle">
          <rect x="42" y="38" width="52" height="66" rx="10" fill="#FFFFFF" stroke="#4A443C" strokeWidth="3" />
          <rect x="38" y="26" width="60" height="16" rx="5" fill="#1E6B57" />
          <rect x="50" y="56" width="36" height="26" rx="4" fill="#DDEEE6" />
          <path d="M62 69h12M68 63v12" stroke="#1E6B57" strokeWidth="3" strokeLinecap="round" />
        </g>
        {[0, 1, 2].map(i => (
          <g key={i} className={`capsule p${i}`}>
            <rect x="-9" y="-4.5" width="18" height="9" rx="4.5" fill={['#C2362B', '#F7B733', '#2B5AA3'][i]} />
            <rect x="0" y="-4.5" width="9" height="9" rx="4.5" fill="#fff" opacity=".85" />
          </g>
        ))}
        <g>
          <rect x="86" y="104" width="160" height="28" rx="8" fill="#F2E3F1" stroke="#7A3E78" strokeWidth="2.5" />
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <g key={i}>
              <rect x={92 + i * 21.5} y="108" width="18" height="20" rx="4" fill="#fff" />
              <text x={101 + i * 21.5} y="122" textAnchor="middle" fontSize="9" fontWeight="700" fill="#7A3E78">{d}</text>
            </g>
          ))}
        </g>
      </svg>
      <span className="pill-count">{count} medicine{count === 1 ? '' : 's'} · reminders set</span>
    </div>
  )
}

// ---------- Setup: two phones linking up ----------
export function LinkPhonesScene({ elderFace, careFace }: { elderFace?: string; careFace?: string }) {
  return (
    <div className="scene scene-link" aria-hidden>
      <div className="mini-phone big"><Face k={careFace} name="" size={40} /></div>
      <div className="link-dots"><i /><i /><i /><i /><i /></div>
      <div className="mini-phone big"><Face k={elderFace} name="" size={40} /><span className="ripple" /></div>
    </div>
  )
}

// ---------- Faces: people pop in around a phone with a tap ripple ----------
export function PeopleScene({ faces }: { faces: (string | undefined)[] }) {
  return (
    <div className="scene scene-people" aria-hidden>
      <div className="mini-phone"><span className="ripple" /><span style={{ fontSize: 22 }}>📞</span></div>
      {faces.slice(0, 4).map((k, i) => <div key={i} className={`pop pos${i}`} style={{ animationDelay: `${0.15 + i * 0.18}s` }}><Face k={k} name="" size={50} /></div>)}
    </div>
  )
}

// ---------- Independence: a balance that tilts between "ask me" and "let them decide" ----------
export function BalanceScene({ preset }: { preset: string }) {
  const tilt = preset === 'cautious' ? -12 : preset === 'independent' ? 12 : 0
  return (
    <div className="scene" aria-hidden>
      <svg width="240" height="130" viewBox="0 0 240 130">
        <path d="M120 40v74M90 118h60" stroke="#4A443C" strokeWidth="5" strokeLinecap="round" />
        <circle cx="120" cy="38" r="7" fill="#4A443C" />
        <g style={{ transform: `rotate(${tilt}deg)`, transformOrigin: '120px 38px', transition: 'transform .6s cubic-bezier(.3,1.5,.5,1)' }}>
          <path d="M40 38h160" stroke="#4A443C" strokeWidth="5" strokeLinecap="round" />
          <g style={{ transform: `rotate(${-tilt}deg)`, transformOrigin: '40px 38px', transition: 'transform .6s' }}>
            <path d="M40 38 22 78h36z" fill="none" stroke="#CFC6B8" strokeWidth="2" />
            <path d="M18 78h44a22 10 0 0 1-44 0z" fill="#DDEEE6" stroke="#1E6B57" strokeWidth="2" />
            <text x="40" y="74" textAnchor="middle" fontSize="20">🛡️</text>
          </g>
          <g style={{ transform: `rotate(${-tilt}deg)`, transformOrigin: '200px 38px', transition: 'transform .6s' }}>
            <path d="M200 38 182 78h36z" fill="none" stroke="#CFC6B8" strokeWidth="2" />
            <path d="M178 78h44a22 10 0 0 1-44 0z" fill="#FBEFD8" stroke="#9A5F0E" strokeWidth="2" />
            <text x="200" y="74" textAnchor="middle" fontSize="20">🌿</text>
          </g>
        </g>
      </svg>
    </div>
  )
}

// ---------- Elder: waving hand, scanner, confetti ----------
export const WaveHand = () => <div className="wave-hand" aria-hidden>👋</div>

export function ScanBox({ children }: { children: ReactNode }) {
  return <div className="scanbox">{children}<span className="scanline" /></div>
}

export function Confetti() {
  const colors = ['#C2362B', '#F7B733', '#1E6B57', '#2B5AA3', '#7A3E78']
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: 28 }, (_, i) => (
        <i key={i} style={{ left: `${(i * 37) % 100}%`, background: colors[i % 5], animationDelay: `${(i % 7) * 0.18}s`, animationDuration: `${2.2 + (i % 5) * 0.3}s` }} />
      ))}
    </div>
  )
}
