import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { BarChart2, LogOut, Zap, Sun, Moon, Headphones, Database } from 'lucide-react';
import { logout } from '../auth';

interface NavItem {
  to: string;
  icon: React.ReactNode;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/api-usage',
    icon: <BarChart2 size={18} />,
    label: 'API Usage',
  },
  {
    to: '/assistance-requests',
    icon: <Headphones size={18} />,
    label: 'Assistance Requests',
  },
];

type ApiMode = 'real' | 'mock';

function readApiMode(): ApiMode {
  try {
    const stored = localStorage.getItem('api-mode');
    return stored === 'mock' ? 'mock' : 'real';
  } catch {
    return 'real';
  }
}

interface SidebarProps {
  onLogout: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export function Sidebar({ onLogout, theme, onToggleTheme }: SidebarProps) {
  const [apiMode, setApiModeState] = useState<ApiMode>(readApiMode);

  // Keep in sync if another tab toggles it.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'api-mode') setApiModeState(readApiMode());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function setApiMode(mode: ApiMode) {
    try { localStorage.setItem('api-mode', mode); } catch {}
    setApiModeState(mode);
  }

  function handleLogout() {
    logout();
    onLogout();
  }

  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__brand">
        <Zap size={20} className="admin-sidebar__brand-icon" />
        <span className="admin-sidebar__brand-name">FlexBook</span>
        <span className="admin-sidebar__brand-tag">Admin</span>
      </div>

      <nav className="admin-sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `admin-sidebar__link ${isActive ? 'admin-sidebar__link--active' : ''}`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="admin-sidebar__bottom">
        <div className="admin-sidebar__section">
          <div className="admin-sidebar__section-label">
            <Database size={12} />
            <span>Data source</span>
          </div>
          <div className="admin-sidebar__mode-toggle" role="group" aria-label="Data source">
            <button
              type="button"
              className={`admin-sidebar__mode-btn ${apiMode === 'real' ? 'admin-sidebar__mode-btn--active' : ''}`}
              onClick={() => setApiMode('real')}
              aria-pressed={apiMode === 'real'}
            >
              Live
            </button>
            <button
              type="button"
              className={`admin-sidebar__mode-btn ${apiMode === 'mock' ? 'admin-sidebar__mode-btn--active' : ''}`}
              onClick={() => setApiMode('mock')}
              aria-pressed={apiMode === 'mock'}
            >
              Mock
            </button>
          </div>
        </div>
        <button className="admin-sidebar__theme-toggle" onClick={onToggleTheme}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>
        <button className="admin-sidebar__logout" onClick={handleLogout}>
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
