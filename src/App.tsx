import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

// Lazy load pages for better performance
const Login = lazy(() => import('./pages/Login'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const DomainManagement = lazy(() => import('./pages/admin/DomainManagement'));
const FormTemplateBuilder = lazy(() => import('./pages/admin/FormTemplateBuilder'));
const FileFormManagement = lazy(() => import('./pages/admin/FileFormManagement'));
const FileFormBuilder = lazy(() => import('./pages/admin/FileFormBuilder'));
const SurveyorManagement = lazy(() => import('./pages/admin/SurveyorManagement'));
const CounterManagement = lazy(() => import('./pages/admin/CounterManagement'));
const Submissions = lazy(() => import('./pages/admin/Submissions'));
const MasterReports = lazy(() => import('./pages/admin/MasterReports'));
const LeadStatusCount = lazy(() => import('./pages/admin/LeadStatusCount'));
const CustomTemplateDashboard = lazy(() => import('./pages/admin/CustomTemplateDashboard'));
const SystemSettings = lazy(() => import('./pages/admin/SystemSettings'));

const SurveyorLayout = lazy(() => import('./pages/surveyor/SurveyorLayout'));
const SurveyorDashboard = lazy(() => import('./pages/surveyor/SurveyorDashboard'));
const SurveyorHistory = lazy(() => import('./pages/surveyor/SurveyorHistory'));
const FillForm = lazy(() => import('./pages/surveyor/FillForm'));

const SharedDashboardLayout = lazy(() => import('./components/layout/SharedDashboardLayout'));
const CounterDashboard = lazy(() => import('./pages/counter/CounterDashboard'));
const TeamLeadDashboard = lazy(() => import('./pages/teamlead/TeamLeadDashboard'));
const TLCustomTemplateDashboard = lazy(() => import('./pages/teamlead/TLCustomTemplateDashboard'));
const TelecallerDashboard = lazy(() => import('./pages/telecaller/TelecallerDashboard'));
const TelecallerLeadsDashboard = lazy(() => import('./pages/teamlead/TelecallerLeadsDashboard'));
const FileHandlerDashboard = lazy(() => import('./pages/filehandler/FileHandlerDashboard'));

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

function FileHandlerRoute({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuth();
  if (!user || role !== 'file_handler') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <Router>
      <Suspense fallback={
        <div className="flex h-screen items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      }>
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
          <Route path="file-forms" element={<FileFormManagement />} />
          <Route path="surveyors" element={<SurveyorManagement />} />
          <Route path="counters" element={<CounterManagement />} />
          <Route path="submissions" element={<Submissions />} />
          <Route path="reports" element={<MasterReports />} />
          <Route path="lead-status" element={<LeadStatusCount />} />
          <Route path="settings" element={<SystemSettings />} />
        </Route>
        
        {/* Full screen Admin Routes */}
        <Route path="/admin/domains/:domainId/template" element={
          <AdminRoute>
            <FormTemplateBuilder />
          </AdminRoute>
        } />
        <Route path="/admin/file-forms/new" element={
          <AdminRoute>
            <FileFormBuilder />
          </AdminRoute>
        } />
        <Route path="/admin/file-forms/edit/:templateIdParam" element={
          <AdminRoute>
            <FileFormBuilder />
          </AdminRoute>
        } />
        <Route path="/admin/reports/custom/:templateId" element={
          <AdminRoute>
            <CustomTemplateDashboard />
          </AdminRoute>
        } />
        <Route path="/admin/telecaller/:telecallerId" element={
          <AdminRoute>
            <TelecallerLeadsDashboard />
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
          <Route path="history" element={<SurveyorHistory />} />
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
        
        {/* Full screen TL Routes */}
        <Route path="/teamlead/analyze/:templateId" element={
          <TeamLeadRoute>
            <TLCustomTemplateDashboard />
          </TeamLeadRoute>
        } />
        <Route path="/teamlead/telecaller/:telecallerId" element={
          <TeamLeadRoute>
            <TelecallerLeadsDashboard />
          </TeamLeadRoute>
        } />

        {/* Telecaller Routes */}
        <Route path="/telecaller" element={
          <TelecallerRoute>
            <SharedDashboardLayout title="Telecaller Portal" homePath="/telecaller/dashboard" />
          </TelecallerRoute>
        }>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<TelecallerDashboard />} />
        </Route>

        {/* File Handler Routes */}
        <Route path="/filehandler" element={
          <FileHandlerRoute>
            <SharedDashboardLayout title="File Handler Portal" homePath="/filehandler/dashboard" />
          </FileHandlerRoute>
        }>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<FileHandlerDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
