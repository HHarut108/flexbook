import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useNavigate } from 'react-router-dom';
import { GoHomeLogo } from '../components/GoHomeLogo';
import { useAuthStore } from '../store/auth.store';
import {
  Wallet,
  Lock,
  ArrowRight,
  Sparkles,
  User,
  Globe,
  Route,
  Check,
  X,
  LogIn,
  type LucideIcon,
} from 'lucide-react';

interface Props {
  onMenuOpen?: () => void;
}

interface Tool {
  id: string;
  name: string;
  tagline: string;
  description: string;
  features: string[];
  path: string;
  requiresAuth: boolean;
  icon: LucideIcon;
  gradient: string;
}

const TOOLS: Tool[] = [
  {
    id: 'budget-planner',
    name: 'Budget Planner',
    tagline: 'Find a multi-stop adventure within your budget',
    description:
      'Tell us your starting point, travel dates, and a budget per person. We search live fares and build the cheapest multi-stop trip that fits — including return flights — so you can explore more for less.',
    features: [
      'Set a total budget per person',
      'Choose your trip style — best value, surprise me, or off the beaten path',
      'See every leg on an interactive map',
    ],
    path: '/trip-planner',
    requiresAuth: true,
    icon: Wallet,
    gradient: 'linear-gradient(135deg, rgba(55,48,163,0.97) 0%, rgba(79,70,229,0.97) 100%)',
  },
];

function ToolCard({ tool, onOpen }: { tool: Tool; onOpen: (tool: Tool) => void }) {
  const Icon = tool.icon;
  return (
    <div
      className="group flex flex-col bg-white/70 backdrop-blur-sm rounded-[24px] border border-border/60 overflow-hidden transition-all hover:border-indigo-border"
      style={{ boxShadow: '0 8px 28px -10px rgba(15,23,42,0.12)' }}
    >
      {/* Visual */}
      <div className="relative h-36 flex items-center justify-center overflow-hidden" style={{ background: tool.gradient }}>
        {/* Decorative orbs */}
        <div className="absolute -top-8 -right-6 w-28 h-28 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -left-8 w-32 h-32 rounded-full bg-white/[0.07]" />
        <Route size={56} className="absolute right-5 bottom-4 text-white/15" strokeWidth={1.5} />
        <div className="relative w-16 h-16 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center backdrop-blur-sm">
          <Icon size={28} className="text-white" />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-6">
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className="text-lg font-bold text-text-primary">{tool.name}</h3>
          {tool.requiresAuth && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-soft border border-indigo-border text-[11px] font-bold text-indigo">
              <Lock size={10} /> Sign in
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-text-secondary mb-3">{tool.tagline}</p>
        <p className="text-sm text-text-muted leading-6 mb-5">{tool.description}</p>

        <ul className="space-y-2 mb-6">
          {tool.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-text-muted">
              <span className="mt-0.5 w-4 h-4 rounded-full bg-emerald/10 flex items-center justify-center shrink-0">
                <Check size={11} className="text-emerald" />
              </span>
              {f}
            </li>
          ))}
        </ul>

        <button
          onClick={() => onOpen(tool)}
          className="mt-auto flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-indigo text-white text-sm font-bold hover:bg-indigo/90 transition-all active:scale-[0.98]"
          style={{ boxShadow: '0 10px 28px rgba(55,48,163,0.28)' }}
        >
          Open {tool.name}
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}

function AuthPrompt({ tool, onClose }: { tool: Tool; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-[400px] bg-white rounded-3xl overflow-hidden animate-fade-in"
        style={{ boxShadow: '0 24px 64px rgba(15,23,42,0.20)' }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-surface border border-border flex items-center justify-center text-text-muted hover:text-text-primary transition-all active:scale-95 z-10"
          aria-label="Close"
        >
          <X size={14} />
        </button>

        <div className="flex justify-center pt-8 pb-3">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.14) 0%, rgba(79,70,229,0.07) 100%)', border: '1px solid rgba(79,70,229,0.22)' }}
          >
            <Lock size={26} className="text-indigo" />
          </div>
        </div>

        <div className="px-6 pb-7 text-center">
          <h3 className="text-xl font-bold text-text-primary mb-2">Sign in to use {tool.name}</h3>
          <p className="text-sm text-text-muted leading-relaxed mb-6">
            {tool.name} is a free tool for FlexBook members. Log in or create an account to start planning.
          </p>
          <div className="flex flex-col gap-2.5">
            <Link
              to={`/login?from=${encodeURIComponent(tool.path)}`}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-indigo text-white text-sm font-bold hover:bg-indigo/90 transition-all active:scale-[0.98]"
              style={{ boxShadow: '0 10px 28px rgba(55,48,163,0.28)' }}
            >
              <LogIn size={15} /> Log in
            </Link>
            <Link
              to="/signup"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl border border-border text-sm font-semibold text-text-primary hover:bg-surface-2 transition-all"
            >
              Create a free account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ToolsScreen({ onMenuOpen }: Props) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : null;
  const [authPrompt, setAuthPrompt] = useState<Tool | null>(null);

  function openTool(tool: Tool) {
    if (tool.requiresAuth && !user) {
      setAuthPrompt(tool);
      return;
    }
    navigate(tool.path);
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Helmet>
        <title>Tools — FlexBook</title>
        <meta
          name="description"
          content="FlexBook Tools — smart planning utilities for multi-stop travellers, including the Budget Planner that builds the cheapest trip within your budget."
        />
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

        <div className="hidden lg:flex items-center gap-1">
          <Link
            to="/"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-text-muted hover:text-text-primary hover:bg-surface-2 transition-all"
          >
            Plan
          </Link>
          <Link
            to="/trips"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-text-muted hover:text-text-primary hover:bg-surface-2 transition-all"
          >
            Trips
          </Link>
          <Link
            to="/deals"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-text-muted hover:text-text-primary hover:bg-surface-2 transition-all"
          >
            Deals
          </Link>
          <Link
            to="/tools"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-indigo bg-indigo-soft border border-indigo-border transition-all"
          >
            Tools
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

      {/* Hero */}
      <div className="relative max-w-5xl mx-auto px-5 pt-14 pb-10 md:px-8 lg:px-10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-soft border border-indigo-border mb-6">
          <Sparkles size={13} className="text-indigo" />
          <span className="text-xs font-bold text-indigo tracking-wide uppercase">FlexBook Tools</span>
        </div>

        <h1
          className="font-black text-text-primary mb-6 leading-[0.95]"
          style={{ fontSize: 'clamp(2.2rem, 5vw, 4.2rem)', letterSpacing: '-0.055em' }}
        >
          Smarter ways to <span className="text-indigo">explore</span>.
        </h1>

        <p className="text-lg md:text-xl text-text-muted leading-8 max-w-[52ch] mx-auto">
          A growing toolkit built for multi-stop travellers. Pick a tool below and let FlexBook do the heavy lifting.
        </p>
      </div>

      {/* Tool grid */}
      <div className="relative max-w-5xl mx-auto px-5 pb-20 md:px-8 lg:px-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TOOLS.map((tool) => (
            <ToolCard key={tool.id} tool={tool} onOpen={openTool} />
          ))}

          {/* More tools teaser */}
          <div className="flex flex-col items-center justify-center text-center rounded-[24px] border border-dashed border-border/70 p-8 min-h-[320px]">
            <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-border flex items-center justify-center mb-4">
              <Globe size={22} className="text-text-muted" />
            </div>
            <p className="text-sm font-semibold text-text-primary mb-1">More tools coming soon</p>
            <p className="text-xs text-text-muted leading-5 max-w-[28ch]">
              We&apos;re building more ways to plan, price, and explore your next adventure.
            </p>
          </div>
        </div>
      </div>

      {authPrompt && <AuthPrompt tool={authPrompt} onClose={() => setAuthPrompt(null)} />}
    </div>
  );
}
