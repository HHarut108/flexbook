import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { User } from 'lucide-react';
import { GoHomeLogo } from './GoHomeLogo';
import { Footer } from './Footer';
import { useAuthStore } from '../store/auth.store';
import { useDocumentTitle, useMetaDescription } from '../hooks/useDocumentTitle';

export type V2NavKey = 'home' | 'search' | 'build' | 'when' | 'budget' | 'how';

const NAV_ITEMS: { key: V2NavKey; label: string; to: string }[] = [
  { key: 'search', label: 'Search', to: '/quick-search' },
  { key: 'build', label: 'Build', to: '/hop-planner' },
  { key: 'when', label: 'When to Go', to: '/when-to-go' },
  { key: 'budget', label: 'Budget', to: '/trip-planner' },
];


const AMBIENT_BG =
  'radial-gradient(ellipse 60% 50% at 20% 5%, rgba(79,70,229,0.08) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 80% 5%, rgba(14,165,233,0.06) 0%, transparent 55%)';

interface Props {
  active: V2NavKey;
  title: string;
  description?: string;
  /** Logged-in avatar click handler — opens AppDrawer. */
  onMenuOpen?: () => void;
  /** Page body. Footer is rendered automatically below. */
  children: ReactNode;
  /** Set false to hide the footer (e.g. inner booking screens). */
  showFooter?: boolean;
}

/**
 * V2 marketing/tool shell. Provides nav (Build / When to Go / Budget /
 * How it works), account avatar, and shared footer. Page body fills
 * naturally below the nav — no enforced 2-column layout (each screen
 * controls its own composition).
 */
export function MarketingShellV2({
  active,
  title,
  description,
  onMenuOpen,
  children,
  showFooter = true,
}: Props) {
  const user = useAuthStore((s) => s.user);
  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : null;
  useDocumentTitle(`${title} — Flexbook`);
  useMetaDescription(description);

  return (
    <div className="min-h-screen relative">
      {/* Subtle ambient wash */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: AMBIENT_BG }} />

      {/* Nav */}
      <nav className="relative z-10 border-b border-border/50 bg-bg/80 backdrop-blur-sm">
        <div className="max-w-6xl xl:max-w-7xl mx-auto flex items-center justify-between px-5 md:px-8 lg:px-10 py-4 md:py-5">
          <Link to="/" aria-label="Flexbook home" className="shrink-0">
            <GoHomeLogo size="lg" variant="light" />
          </Link>

          {/* Center nav (Build / When to Go / Budget) */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.key}
                to={item.to}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
                  item.key === active
                    ? 'bg-text-primary text-bg'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-2 md:gap-3">
            <Link
              to="/about"
              className={`hidden md:inline-flex px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                active === 'how'
                  ? 'bg-text-primary text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
              }`}
            >
              How it works
            </Link>

            {!user && (
              <Link
                to="/login"
                className="hidden md:inline-block text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors px-2"
              >
                Sign in
              </Link>
            )}

            <button
              onClick={onMenuOpen}
              className="w-11 h-11 md:w-10 md:h-10 rounded-full bg-surface border border-border flex items-center justify-center text-indigo-mid hover:bg-indigo-soft hover:border-indigo-border transition-all"
              style={{ boxShadow: '0 4px 10px rgba(15,23,42,0.06)' }}
              aria-label={user ? 'Account menu' : 'Sign in'}
            >
              {initials ? (
                <span className="text-xs font-bold text-indigo leading-none">{initials}</span>
              ) : (
                <User size={16} />
              )}
            </button>
          </div>
        </div>

        {/* Mobile nav lives in the AppDrawer (tap the avatar). No second row
            of pills on phone — keeps the top chrome to a single bar so the
            page itself gets the screen. */}
      </nav>

      {/* Body */}
      <main className="relative z-0">{children}</main>

      {showFooter && <Footer />}
    </div>
  );
}
