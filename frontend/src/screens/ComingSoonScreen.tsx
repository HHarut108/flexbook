import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { GoHomeLogo } from '../components/GoHomeLogo';
import { ArrowLeft, Bell, Plane, Star } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { User } from 'lucide-react';

interface Props {
  title: string;
  description: string;
  onMenuOpen?: () => void;
}

export function ComingSoonScreen({ title, description, onMenuOpen }: Props) {
  const user = useAuthStore((s) => s.user);
  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : null;

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Helmet>
        <title>{title} — FlexBook</title>
      </Helmet>

      {/* Ambient background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 20% 10%, rgba(79,70,229,0.10) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 80% 5%, rgba(14,165,233,0.08) 0%, transparent 55%), radial-gradient(ellipse 40% 30% at 50% 95%, rgba(249,115,22,0.05) 0%, transparent 50%)',
        }}
      />

      {/* Nav */}
      <nav className="relative flex items-center justify-between px-5 pt-7 pb-4 md:px-8 md:py-5 lg:px-10 lg:border-b lg:border-border/50">
        <GoHomeLogo size="lg" variant="light" />

        {/* Desktop nav links */}
        <div className="hidden lg:flex items-center gap-1">
          <Link
            to="/"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-text-muted hover:text-text-primary hover:bg-surface-2 transition-all"
          >
            Plan
          </Link>
          <Link
            to="/trips"
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              title === 'Trips'
                ? 'text-indigo bg-indigo-soft border border-indigo-border'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
            }`}
          >
            Trips
          </Link>
          <Link
            to="/deals"
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              title === 'Deals'
                ? 'text-indigo bg-indigo-soft border border-indigo-border'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-2'
            }`}
          >
            Deals
          </Link>
          <Link
            to="/about"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-text-muted hover:text-text-primary hover:bg-surface-2 transition-all"
          >
            About Us
          </Link>
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
            {initials
              ? <span className="text-xs font-bold text-indigo leading-none">{initials}</span>
              : <User size={16} />
            }
          </button>
        </div>
      </nav>

      {/* Content */}
      <div className="relative flex flex-col items-center justify-center min-h-[calc(100dvh-80px)] px-5 text-center">
        {/* Icon */}
        <div
          className="w-20 h-20 rounded-[28px] flex items-center justify-center mb-8"
          style={{
            background: 'linear-gradient(135deg, rgba(79,70,229,0.12) 0%, rgba(79,70,229,0.06) 100%)',
            border: '1.5px solid rgba(79,70,229,0.18)',
          }}
        >
          <Plane size={32} className="text-indigo" />
        </div>

        {/* Coming soon badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange/10 border border-orange/20 mb-5">
          <Star size={11} className="text-orange" />
          <span className="text-xs font-bold text-orange tracking-wide uppercase">Coming Soon</span>
        </div>

        <h1
          className="font-black text-text-primary mb-4 leading-tight"
          style={{ fontSize: 'clamp(2.2rem, 5vw, 4rem)', letterSpacing: '-0.05em' }}
        >
          {title}
        </h1>

        <p className="text-base md:text-lg text-text-muted max-w-[42ch] leading-7 mb-10">
          {description}
        </p>

        {/* Notify CTA */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-surface border border-border text-text-muted text-sm">
            <Bell size={15} className="text-indigo-mid shrink-0" />
            <span>We'll let you know when it's ready.</span>
          </div>
          <Link
            to="/"
            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo text-white text-sm font-semibold hover:bg-indigo/90 transition-all active:scale-95"
            style={{ boxShadow: '0 8px 20px rgba(55,48,163,0.25)' }}
          >
            <ArrowLeft size={15} />
            Plan a trip now
          </Link>
        </div>

        {/* Decorative dots */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-2 opacity-20">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-indigo"
              style={{ opacity: 1 - i * 0.15 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
