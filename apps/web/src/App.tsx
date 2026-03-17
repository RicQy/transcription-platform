import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Role } from '@transcribe/shared-types';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AudioUploadPage from './pages/AudioUploadPage';
import EditorPage from './pages/EditorPage';
import StyleGuideListPage from './pages/admin/StyleGuideListPage';
import StyleGuideUploadPage from './pages/admin/StyleGuideUploadPage';
import RuleEditorPage from './pages/admin/RuleEditorPage';
import AppShell from './components/layout/AppShell';
import ProtectedRoute from './components/layout/ProtectedRoute';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/audio/upload" element={<AudioUploadPage />} />
              <Route path="/editor/:audioId" element={<EditorPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute requiredRole={Role.ADMIN} />}>
            <Route element={<AppShell />}>
              <Route path="/admin/style-guides" element={<StyleGuideListPage />} />
              <Route path="/admin/style-guides/upload" element={<StyleGuideUploadPage />} />
              <Route path="/admin/style-guides/:guideId/rules" element={<RuleEditorPage />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
