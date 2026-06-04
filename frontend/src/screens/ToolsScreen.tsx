import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MarketingShell } from '../components/MarketingShell';
import { ToolCard, type Tool } from '../components/ToolCard';
import { useAuthStore } from '../store/auth.store';
import {
  Wallet,
  Lock,
  Sparkles,
  Check,
  X,
  LogIn,
  CalendarSearch,
  Waypoints,
} from 'lucide-react';

interface Props {
  onMenuOpen?: () => void;
}

export const TOOLS: Tool[] = [
  {
    id: 'hop-planner',
    name: 'Hop Planner',
    tagline: 'Chain the cheapest one-way fares into a 15-stop adventure',
    description:
      "Pick a starting airport — we'll surface tonight's cheapest one-way fares out of it. Hop on the one you like, land in a new city, and we'll instantly show you the cheapest next hop from there. Up to 15 stops, no return required, no account needed.",
    features: [
      'Start from any airport — we detect your nearest one',
      'Always the cheapest available next-leg fare',
      'Build up to a 15-stop trip on the fly — no fixed itinerary',
    ],
    path: '/hop-planner',
    requiresAuth: false,
    icon: Waypoints,
    gradient: 'linear-gradient(135deg, rgba(249,115,22,0.97) 0%, rgba(234,108,10,0.97) 100%)',
  },
  {
    id: 'when-to-go',
    name: 'When To Go',
    tagline: "Find the cheapest day to fly between any two cities",
    description:
      "Pick a departure city, an arrival city, and a flexible window — we'll show you the single cheapest day to fly. Change anything and the answer updates live.",
    features: [
      'Search any city pair, no account needed',
      'Use a preset (this month, next 90 days) or a custom date range',
      'Tap "Book this flight" to jump straight into the cheapest itinerary',
    ],
    path: '/when-to-go',
    requiresAuth: false,
    icon: CalendarSearch,
    gradient: 'linear-gradient(135deg, rgba(13,148,136,0.97) 0%, rgba(16,185,129,0.97) 100%)',
  },
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
  const [authPrompt, setAuthPrompt] = useState<Tool | null>(null);

  function openTool(tool: Tool) {
    if (tool.requiresAuth && !user) {
      setAuthPrompt(tool);
      return;
    }
    navigate(tool.path);
  }

  const left = (
    <div className="max-w-xl">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-soft border border-indigo-border mb-6">
        <Sparkles size={13} className="text-indigo" />
        <span className="text-xs font-bold text-indigo tracking-wide uppercase">FlexBook Tools</span>
      </div>

      <h1
        className="font-black text-text-primary leading-[0.95]"
        style={{ fontSize: 'clamp(2.6rem, 5.2vw, 4.6rem)', letterSpacing: '-0.055em' }}
      >
        Smarter ways to <span className="text-indigo">explore</span>.
      </h1>

      <p className="mt-5 text-base md:text-lg text-text-muted leading-7 max-w-[46ch]">
        A growing toolkit built for multi-stop travellers. Each tool tackles a
        different part of the trip — pick one and let FlexBook do the heavy
        lifting.
      </p>

      {/* Tool count + free-tier callout so the rail still has personality
          without duplicating per-card feature bullets. */}
      <div className="mt-7 flex flex-wrap gap-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-2 border border-border text-xs font-semibold text-text-secondary">
          <Sparkles size={11} className="text-indigo" />
          {TOOLS.length} tool{TOOLS.length === 1 ? '' : 's'} live
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald/10 border border-emerald/20 text-xs font-semibold text-emerald">
          <Check size={11} strokeWidth={3} />
          Free to use
        </span>
      </div>
    </div>
  );

  const right = (
    <div className="flex flex-col gap-4">
      {TOOLS.map((tool) => (
        <ToolCard key={tool.id} tool={tool} onOpen={openTool} />
      ))}
      <p className="text-center text-xs text-text-muted/70 pt-1">
        More tools coming soon.
      </p>
    </div>
  );

  return (
    <>
      <MarketingShell
        active="tools"
        title="Tools"
        description="FlexBook Tools — smart planning utilities for multi-stop travellers, including Hop Planner (cheapest next-leg chain), When To Go (cheapest day to fly), and Budget Planner (multi-stop trip within your budget)."
        onMenuOpen={onMenuOpen}
        left={left}
        right={right}
      />
      {authPrompt && <AuthPrompt tool={authPrompt} onClose={() => setAuthPrompt(null)} />}
    </>
  );
}
