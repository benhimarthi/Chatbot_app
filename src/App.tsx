import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './LandingPage';
import { DashboardLayout } from './pages/DashboardLayout';
import { DashboardHome } from './pages/DashboardHome';
import { DocumentsPage } from './pages/DocumentsPage';
import { ChatPage } from './pages/ChatPage';
import { SettingsPage } from './pages/SettingsPage';
import { BusinessPage } from './pages/BusinessPage';
import { InstallPage } from './pages/InstallPage';
import { WidgetPage } from './pages/WidgetPage';
import { AdminPage } from './pages/AdminPage';
import { CustomersPage } from './pages/CustomersPage';
import { WhatsAppPage } from './pages/WhatsAppPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import * as React from 'react';
import { auth, getUserSettings, updateLastActive, logEvent } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      // Update last active and log visit
      updateLastActive(u.uid);
      logEvent(u.uid, 'session', 'Administrator session started');

      const unsubscribeSettings = getUserSettings(u.uid, (settings) => {
        const isAdm = settings?.role === 'admin' || u.email === 'technov009@gmail.com';
        setIsAdmin(isAdm);
        setLoading(false);
      });

      return () => unsubscribeSettings();
    });

    return () => unsubscribeAuth();
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        updateLastActive(u.uid);
        logEvent(u.uid, 'session', 'User session started');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/widget" element={<WidgetPage />} />

          {/* Dashboard Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardHome />} />
            <Route path="documents" element={<DocumentsPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="business" element={<BusinessPage />} />
            <Route path="whatsapp" element={<WhatsAppPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="install" element={<InstallPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route
              path="admin"
              element={
                <AdminRoute>
                  <AdminPage />
                </AdminRoute>
              }
            />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
