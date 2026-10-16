import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './styles.css'
import { ToastProvider } from './components/ui'
import ElderApp from './elder/ElderApp'
import CaretakerApp from './caretaker/CaretakerApp'
import { CaretakerOnboarding, ElderOnboarding, JoinLink } from './onboarding/Onboarding'
import { Launcher, Pricing } from './showcase/Showcase'
import { LiveGate, Login } from './live/Login'
import { TrySandbox } from './showcase/Try'
import { EMBEDDED as embedded, isLive } from './data/mode'
import { bootLive } from './data/live'

if (isLive()) bootLive()


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Launcher />} />
          {/* The scripted offline demo is hidden; old links go to the live one. */}
          <Route path="/demo" element={<Navigate to="/try" replace />} />
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
