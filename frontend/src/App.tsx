import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { ChatApp } from '@/components/ChatApp';
import LoginPage from '@/components/admin/LoginPage';
import AdminHome from '@/components/admin/AdminHome';
import { useAuthStore } from '@/store/authStore';
import { Toaster, toast } from '@/components/ui/Toast';
import { useI18n } from '@/i18n';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const location = useLocation();
  const isAuthed = useAuthStore((s) => s.isAuthenticated());
  const { t } = useI18n();
  const fired = (globalThis as any).__auth_toast_fired ?? new Set<string>();
  (globalThis as any).__auth_toast_fired = fired;

  // 避免在 render 期间触发 Toast 导致 React 警告
  useEffect(() => {
    if (!isAuthed) {
      const key = location.pathname + location.search;
      if (!fired.has(key)) {
        fired.add(key);
        toast({ type: 'warning', title: t('请先登录') });
      }
    }
  }, [isAuthed, location.pathname, location.search, t]);

  if (isAuthed) return children;
  const target = location.pathname + (location.search || '');
  return <Navigate to={`/login?redirect=${encodeURIComponent(target)}`} replace />;
}

function LoginRoute() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const raw = params.get('redirect');
  const redirect = raw ? decodeURIComponent(raw) : '/home';
  return <LoginPage onSuccess={() => navigate(redirect, { replace: true })} />;
}

function App() {
  const restore = useAuthStore((s) => s.restore);
  useEffect(() => {
    restore();
  }, [restore]);

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ChatApp />} />
          <Route path="/login" element={<LoginRoute />} />
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <AdminHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/home/:tab"
            element={
              <ProtectedRoute>
                <AdminHome />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;