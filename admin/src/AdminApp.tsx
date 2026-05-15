import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated } from './auth';
import { LoginPage } from './pages/LoginPage';
import { ApiUsagePage } from './pages/ApiUsagePage';
import { AssistanceRequestsPage } from './pages/AssistanceRequestsPage';
import { UsersPage } from './pages/UsersPage';
import { Sidebar } from './components/Sidebar';
import './admin.css';

type Theme = 'dark' | 'light';

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem('admin-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return 'dark';
}

export default function AdminApp() {
  const [authed, setAuthed] = useState(isAuthenticated);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('admin-theme', next); } catch {}
      return next;
    });
  }

  return (
    <div className="admin-root" data-theme={theme}>
      {authed ? (
        <div className="admin-shell">
          <Sidebar onLogout={() => setAuthed(false)} theme={theme} onToggleTheme={toggleTheme} />
          <main className="admin-main">
            <Routes>
              <Route path="api-usage" element={<ApiUsagePage />} />
              <Route path="assistance-requests" element={<AssistanceRequestsPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="*" element={<Navigate to="api-usage" replace />} />
            </Routes>
          </main>
        </div>
      ) : (
        <LoginPage onSuccess={() => setAuthed(true)} />
      )}
    </div>
  );
}
