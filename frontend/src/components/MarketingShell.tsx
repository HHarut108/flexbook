import type { ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { User } from 'lucide-react';
import { GoHomeLogo } from './GoHomeLogo';
import { useAuthStore } from '../store/auth.store';

const AMBIENT_BG =
  'radial-gradient(ellipse 60% 50% at 20% 10%, rgba(79,70,229,0.10) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 80% 5%, rgba(14,165,233,0.08) 0%, transparent 55%), radial-gradient(ellipse 40% 30% at 50% 95%, rgba(249,115,22,0.05) 0%, transparent 50%)';

type NavKey = 'plan' | 'trips' | 'deals' | 'tools' | 'about';

const NAV_ITEMS: { key: NavKey; label: string; to: string }[] = [
  { key: 'plan', label: 'Plan', to: '/' },
  { key: 'trips', label: 'Trips', to: '/trips' },
  { key: 'deals', label: 'Deals', to: '/deals' },
  { key: 'tools', label: 'Tools', to: '/tools' },
  { key: 'about', label: 'About Us', to: '/about' },
];

interface Props {
  active: NavKey;
  title: string;
  description?: string;
  onMenuOpen?: () => void;
  left: ReactNode;
  right: ReactNode;
}

/**
 * Two-column marketing layout shared by the Trips, Deals, Tools and About
 * pages. Mirrors the HomeScreen structure: full-width nav, then a body that is
 * a single column on mobile and a left text panel + right action card from md:
 * up. Keeping this in one place is what stops the per-page headers drifting
 * out of sync.
 */
export function MarketingShell({ active, title, description, onMenuOpen, left, right }: Props) {
  const user = useAuthStore((s) => s.user);
  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : null;

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Helmet>
        <title>{title} — FlexBook</title>
        {description && <meta name="description" content={description} />}
      </Helmet>

      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: AMBIENT_BG }} />

      {/* Nav */}
      <nav className="relative flex items-center justify-between px-5 pt-7 pb-4 md:px-8 md:py-5 lg:px-10 lg:border-b lg:border-border/50">
        <GoHomeLogo size="lg" variant="light" />

        <div className="hidden lg:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                item.key === active
                  ? 'text-indigo bg-indigo-soft border border-indigo-border'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {!user && (
            <Link
              to="/login"
              className="hidden lg:block text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors"
            >
              Sign in
            </Link>
          )}
          <button
            onClick={onMenuOpen}
            className="w-10 h-10 rounded-2xl bg-surface border border-border flex items-center justify-center text-indigo-mid transition-all hover:bg-indigo-soft hover:border-indigo-border"
            style={{ boxShadow: '0 4px 12px rgba(15,23,42,0.08)' }}
            aria-label="Account"
          >
            {initials ? (
              <span className="text-xs font-bold text-indigo leading-none">{initials}</span>
            ) : (
              <User size={16} />
            )}
          </button>
        </div>
      </nav>

      {/* Body: single column on mobile, 2-panel from md: up */}
      <div
        className="relative md:flex md:items-stretch md:max-w-6xl md:mx-auto xl:max-w-7xl"
        style={{ minHeight: 'calc(100dvh - 72px)' }}
      >
        {/* Left panel: informational text */}
        <div className="px-5 pt-6 pb-2 md:flex-1 md:flex md:flex-col md:justify-center md:px-8 md:py-10 lg:px-12 lg:py-12">
          {left}
        </div>

        {/* Right panel: action card */}
        <div className="px-5 pb-10 md:w-[400px] md:flex-shrink-0 md:bg-surface/80 md:backdrop-blur-sm md:px-6 md:py-8 md:flex md:flex-col md:justify-center md:my-8 md:mr-6 md:rounded-[28px] md:border md:border-border/60 md:shadow-[0_18px_50px_-20px_rgba(15,23,42,0.18)] lg:w-[440px] lg:px-8 lg:my-10 lg:mr-8 xl:w-[480px]">
          {right}
        </div>
      </div>
    </div>
  );
}
