import { Navigate, Route, Routes } from 'react-router'
import { RequireRole } from './auth/RequireRole'
import { LoginPage } from './pages/LoginPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { CaretakerIndex, CaretakerLayout } from './pages/caretaker/CaretakerLayout'
import { AddElderPage } from './pages/caretaker/AddElderPage'
import { AssessmentPage } from './pages/caretaker/AssessmentPage'
import { ElderOverviewPage } from './pages/caretaker/ElderOverviewPage'
import { ElderHome } from './pages/elder/ElderHome'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/elder/*" element={<RequireRole role="elder"><ElderHome /></RequireRole>} />
      <Route path="/caretaker" element={<RequireRole role="caretaker"><CaretakerLayout /></RequireRole>}>
        <Route index element={<CaretakerIndex />} />
        <Route path="add" element={<AddElderPage />} />
        <Route path="elders/:elderId" element={<ElderOverviewPage />} />
        <Route path="elders/:elderId/assessment" element={<AssessmentPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
