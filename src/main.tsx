import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './styles.css'
import { ToastProvider } from './components/ui'
import ElderApp from './elder/ElderApp'
import CaretakerApp from './caretaker/CaretakerApp'
import { CaretakerOnboarding, ElderOnboarding, JoinLink } from './onboarding/Onboarding'
import { Launcher, Pricing, SideBySide } from './showcase/Showcase'
import { LiveGate, Login } from './live/Login'
import { TrySandbox } from './showcase/Try'
import { isLive } from './data/mode'
import { bootLive } from './data/live'

if (isLive()) bootLive()

// Inside the side-by-side demo the apps fill their iframe (no phone frame of their own).
const embedded = new URLSearchParams(location.search).has('embed') || window.self !== window.top

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Launcher />} />
          <Route path="/demo" element={<SideBySide />} />
          <Route path="/try" element={<TrySandbox />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/elder" element={<LiveGate app="elder"><ElderApp framed={!embedded} /></LiveGate>} />
          <Route path="/caretaker/*" element={<LiveGate app="caretaker"><CaretakerApp framed={!embedded} /></LiveGate>} />
          <Route path="/onboarding/caretaker" element={<CaretakerOnboarding />} />
          <Route path="/onboarding/elder" element={<ElderOnboarding />} />
          <Route path="/join/:code" element={<JoinLink />} />
          <Route path="*" element={<Launcher />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
