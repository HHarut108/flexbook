import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated } from './auth';
import { LoginPage } from './pages/LoginPage';
import { ApiUsagePage } from './pages/ApiUsagePage';
import { Sidebar } from './components/Sidebar';
import './admin.css';

export default function AdminApp() {
  const [authed, setAuthed] = useState(isAuthenticated);

  if (!authed) {
    return <LoginPage onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div className="admin-shell">
      <Sidebar onLogout={() => setAuthed(false)} />
      <main className="admin-main">
        <Routes>
          <Route path="api-usage" element={<ApiUsagePage />} />
          <Route path="*" element={<Navigate to="api-usage" replace />} />
        </Routes>
      </main>
    </div>
  );
}
