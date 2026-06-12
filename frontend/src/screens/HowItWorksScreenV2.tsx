import { Link } from 'react-router-dom';
import { Plane, Globe, Zap, Shield, ArrowRight, Rocket, Search, Waypoints, CalendarSearch, Wallet } from 'lucide-react';
import { MarketingShellV2 } from '../components/MarketingShellV2';

interface Props {
  onMenuOpen?: () => void;
}

const PROMISES: { icon: React.ReactNode; text: string }[] = [
  { icon: <Zap size={15} className="text-orange" />, text: 'Always the cheapest next hop, priced in real time' },
  { icon: <Globe size={15} className="text-indigo" />, text: 'Multi-stop by default — up to 15 stops per trip' },
  { icon: <Plane size={15} className="text-sky" />, text: 'No fixed destination, no return ticket required' },
  { icon: <Shield size={15} className="text-emerald" />, text: 'No account needed — your trip lives in the URL' },
];

const STEPS: { n: number; title: string; body: string; icon: React.ReactNode; tone: string }[] = [
  {
    n: 1,
    title: "Start with Trip Builder — it's the flagship.",
    body:
      "Pick a starting airport, see the cheapest flights out, then keep going — one hop at a time. The other three tools are shortcuts for when you already know the route, the dates, or the budget.",
    icon: <Search size={18} className="text-sky" />,
    tone: 'bg-sky-soft',
  },
  {
    n: 2,
    title: 'We price live fares — never the brochure',
    body:
      "Every option you see is a real fare we just pulled. No bait-and-switch — what you see is the price you can book at.",
    icon: <Waypoints size={18} className="text-orange" />,
    tone: 'bg-orange-soft',
  },
  {
    n: 3,
    title: "Chain. Adjust. Share. Book.",
    body:
      "Add stops, swap dates, share the URL with a friend, or jump straight to checkout. Your trip lives in the URL — no account required.",
    icon: <CalendarSearch size={18} className="text-emerald" />,
    tone: 'bg-emerald-soft',
  },
];

export function HowItWorksScreenV2({ onMenuOpen }: Props) {
  return (
    <MarketingShellV2
      active="how"
      title="How it works"
      description="Flexbook chains the cheapest multi-stop flights across Europe. Live fares, no account, no upsell."
      onMenuOpen={onMenuOpen}
    >
      {/* Hero */}
      <section className="max-w-6xl xl:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 pt-12 md:pt-20 pb-10">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-16 items-start">
          <div>
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-soft border border-indigo-border text-indigo text-xs font-bold mb-7">
              <Plane size={12} />
              How Flexbook works
            </span>

            <h1
              className="font-black text-text-primary leading-[0.95]"
              style={{ fontSize: 'clamp(2.4rem, 5.4vw, 4.4rem)', letterSpacing: '-0.045em' }}
            >
              Cheaper trips.<br />
              More stops. <span className="text-indigo">No account.</span>
            </h1>

            <p className="mt-6 text-base md:text-lg text-text-muted leading-7 max-w-[48ch]">
              Flexbook flips the fixed round-trip model. We price the cheapest live one-way fare from wherever you are right now, then let you keep going — the cheapest next hop, one tap at a time. No login required.
            </p>

            <ul className="mt-7 space-y-2.5">
              {PROMISES.map((p) => (
                <li key={p.text} className="flex items-center gap-3 text-sm text-text-secondary">
                  <span className="w-9 h-9 rounded-xl bg-surface border border-border flex items-center justify-center shrink-0">
                    {p.icon}
                  </span>
                  {p.text}
                </li>
              ))}
            </ul>
          </div>

          {/* Action card */}
          <div
            className="bg-surface rounded-[28px] border border-border/60 p-7 md:p-8 text-center"
            style={{ boxShadow: '0 24px 60px -20px rgba(15,23,42,0.18)' }}
          >
            <div
              className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.12) 0%, rgba(79,70,229,0.06) 100%)', border: '1.5px solid rgba(79,70,229,0.18)' }}
            >
              <Rocket size={28} className="text-indigo" />
            </div>
            <h2 className="text-xl font-black text-text-primary mb-2">Ready to explore?</h2>
            <p className="text-sm text-text-muted leading-6 mb-6 max-w-[34ch] mx-auto">
              Plan, price, and share a full multi-stop itinerary in seconds — no travel agent, no spreadsheet.
            </p>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-indigo text-white text-sm font-bold hover:bg-indigo/90 transition-all active:scale-[0.98]"
              style={{ boxShadow: '0 10px 28px rgba(55,48,163,0.28)' }}
            >
              Start planning
              <ArrowRight size={15} />
            </Link>
            <Link
              to="/tools"
              className="mt-3 inline-flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-border text-sm font-semibold text-text-primary hover:bg-surface-2 transition-all"
            >
              Browse all tools
            </Link>
          </div>
        </div>
      </section>

      {/* Three steps */}
      <section className="max-w-6xl xl:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 mt-8 md:mt-16">
        <div className="text-center mb-10">
          <p className="text-[11px] font-extrabold tracking-[0.18em] text-orange uppercase mb-3">
            Three steps
          </p>
          <h2
            className="font-black text-text-primary leading-tight"
            style={{ fontSize: 'clamp(1.8rem, 3.8vw, 2.8rem)', letterSpacing: '-0.04em' }}
          >
            From "I might travel" to a booked itinerary.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map((step) => (
            <div
              key={step.n}
              className="bg-surface rounded-[24px] border border-border/60 p-6"
              style={{ boxShadow: '0 12px 32px -16px rgba(15,23,42,0.12)' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className={`w-10 h-10 rounded-2xl ${step.tone} flex items-center justify-center`}>
                  {step.icon}
                </span>
                <span className="text-xs font-extrabold text-text-muted tracking-wider">STEP {step.n}</span>
              </div>
              <h3 className="text-base font-bold text-text-primary mb-2">{step.title}</h3>
              <p className="text-sm text-text-muted leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tools strip */}
      <section className="max-w-6xl xl:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 mt-16 md:mt-20">
        <div
          className="rounded-[28px] border border-border/60 bg-surface p-7 md:p-10 grid md:grid-cols-2 gap-6 items-center"
          style={{ boxShadow: '0 18px 50px -20px rgba(15,23,42,0.14)' }}
        >
          <div>
            <h3
              className="font-black text-text-primary leading-tight mb-3"
              style={{ fontSize: 'clamp(1.4rem, 2.6vw, 2rem)', letterSpacing: '-0.035em' }}
            >
              Four tools. One goal: cheaper, smarter trips.
            </h3>
            <p className="text-sm md:text-base text-text-muted leading-7">
              Each tool tackles a different starting point. Pick the one that matches what you already know — Flexbook handles the rest.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ToolPill icon={<Search size={15} />} label="Find a Flight" to="/quick-search" />
            <ToolPill icon={<Waypoints size={15} />} label="Trip Builder" to="/hop-planner" />
            <ToolPill icon={<CalendarSearch size={15} />} label="When to Go" to="/when-to-go" />
            <ToolPill icon={<Wallet size={15} />} label="Plan by Budget" to="/trip-planner" />
          </div>
        </div>
      </section>
    </MarketingShellV2>
  );
}

function ToolPill({ icon, label, to }: { icon: React.ReactNode; label: string; to: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2.5 px-4 py-3 rounded-2xl border border-border/60 bg-surface hover:bg-surface-2 transition-all text-sm font-semibold text-text-primary"
    >
      <span className="text-indigo">{icon}</span>
      {label}
      <ArrowRight size={13} className="ml-auto text-text-muted" />
    </Link>
  );
}
