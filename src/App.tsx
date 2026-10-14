import { Navigate, Route, Routes } from 'react-router'
import { RequireRole } from './auth/RequireRole'
import { LoginPage } from './pages/LoginPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { CaretakerHome } from './pages/CaretakerHome'
import { ElderHome } from './pages/ElderHome'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/elder/*" element={<RequireRole role="elder"><ElderHome /></RequireRole>} />
      <Route path="/caretaker/*" element={<RequireRole role="caretaker"><CaretakerHome /></RequireRole>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
