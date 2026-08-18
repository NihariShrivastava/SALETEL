import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

// Pages - We will create these shortly
import Login from './pages/Login';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import DomainManagement from './pages/admin/DomainManagement';
import FormTemplateBuilder from './pages/admin/FormTemplateBuilder';
import SurveyorManagement from './pages/admin/SurveyorManagement';
import CounterManagement from './pages/admin/CounterManagement';
import Submissions from './pages/admin/Submissions';
import MasterReports from './pages/admin/MasterReports';

import SurveyorLayout from './pages/surveyor/SurveyorLayout';
import SurveyorDashboard from './pages/surveyor/SurveyorDashboard';
import FillForm from './pages/surveyor/FillForm';

import SharedDashboardLayout from './components/layout/SharedDashboardLayout';
import CounterDashboard from './pages/counter/CounterDashboard';
import TeamLeadDashboard from './pages/teamlead/TeamLeadDashboard';
import TelecallerDashboard from './pages/telecaller/TelecallerDashboard';

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuth();
  if (!user || role !== 'admin') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function SurveyorRoute({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuth();
  if (!user || role !== 'surveyor') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function CounterRoute({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuth();
  if (!user || role !== 'counter') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function TeamLeadRoute({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuth();
  if (!user || role !== 'team_lead') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function TelecallerRoute({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuth();
  if (!user || role !== 'telecaller') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="domains" element={<DomainManagement />} />
          <Route path="surveyors" element={<SurveyorManagement />} />
          <Route path="counters" element={<CounterManagement />} />
          <Route path="submissions" element={<Submissions />} />
          <Route path="reports" element={<MasterReports />} />
        </Route>
        
        {/* Full screen Admin Routes */}
        <Route path="/admin/domains/:domainId/template" element={
          <AdminRoute>
            <FormTemplateBuilder />
          </AdminRoute>
        } />

        {/* Surveyor Routes */}
        <Route path="/surveyor" element={
          <SurveyorRoute>
            <SurveyorLayout />
          </SurveyorRoute>
        }>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<SurveyorDashboard />} />
          <Route path="fill" element={<FillForm />} />
        </Route>

        {/* Counter Routes */}
        <Route path="/counter" element={
          <CounterRoute>
            <SharedDashboardLayout title="Counter Workstation" homePath="/counter/dashboard" />
          </CounterRoute>
        }>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<CounterDashboard />} />
        </Route>

        {/* Team Lead Routes */}
        <Route path="/teamlead" element={
          <TeamLeadRoute>
            <SharedDashboardLayout title="Team Lead Portal" homePath="/teamlead/dashboard" />
          </TeamLeadRoute>
        }>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<TeamLeadDashboard />} />
        </Route>

        {/* Telecaller Routes */}
        <Route path="/telecaller" element={
          <TelecallerRoute>
            <SharedDashboardLayout title="Telecaller Portal" homePath="/telecaller/dashboard" />
          </TelecallerRoute>
        }>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<TelecallerDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
