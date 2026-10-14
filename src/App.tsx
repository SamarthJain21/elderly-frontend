import { Navigate, Outlet, Route, Routes } from 'react-router'
import { RequireRole } from './auth/RequireRole'
import { LoginPage } from './pages/LoginPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { CaretakerIndex, CaretakerLayout } from './pages/caretaker/CaretakerLayout'
import { AddElderPage } from './pages/caretaker/AddElderPage'
import { AssessmentPage } from './pages/caretaker/AssessmentPage'
import { ElderOverviewPage } from './pages/caretaker/ElderOverviewPage'
import { ElderShell } from './pages/caretaker/ElderShell'
import { RulesPage } from './pages/caretaker/RulesPage'
import { ProfilePage } from './pages/caretaker/ProfilePage'
import { FamilyChatPage } from './pages/caretaker/FamilyChatPage'
import { ContactsPage } from './pages/caretaker/ContactsPage'
import { ElderHome } from './pages/elder/ElderHome'
import { ElderChat } from './pages/elder/ElderChat'
import { ElderFamily } from './pages/elder/ElderFamily'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/elder" element={<RequireRole role="elder"><Outlet /></RequireRole>}>
        <Route index element={<ElderHome />} />
        <Route path="chat" element={<ElderChat />} />
        <Route path="family" element={<ElderFamily />} />
      </Route>
      <Route path="/caretaker" element={<RequireRole role="caretaker"><CaretakerLayout /></RequireRole>}>
        <Route index element={<CaretakerIndex />} />
        <Route path="add" element={<AddElderPage />} />
        <Route path="elders/:elderId" element={<ElderShell />}>
          <Route index element={<ElderOverviewPage />} />
          <Route path="chat" element={<FamilyChatPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="rules" element={<RulesPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
        <Route path="elders/:elderId/assessment" element={<AssessmentPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
