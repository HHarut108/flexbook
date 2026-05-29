import { Link } from 'react-router-dom';
import { Plane, Globe, Zap, Shield, ArrowRight, Rocket } from 'lucide-react';
import { MarketingShell } from '../components/MarketingShell';
import { useAuthStore } from '../store/auth.store';

interface Props {
  onMenuOpen?: () => void;
}

const HIGHLIGHTS: { icon: React.ReactNode; text: string }[] = [
  { icon: <Zap size={15} className="text-orange" />, text: 'Always the cheapest next hop, priced in real time' },
  { icon: <Globe size={15} className="text-indigo" />, text: 'Multi-stop by default — up to 15 stops per trip' },
  { icon: <Plane size={15} className="text-sky-500" />, text: 'No fixed destination, no return ticket required' },
  { icon: <Shield size={15} className="text-emerald" />, text: 'No account needed — your trip lives in the URL' },
];

export function AboutScreen({ onMenuOpen }: Props) {
  const user = useAuthStore((s) => s.user);

  const left = (
    <div className="max-w-xl">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-soft border border-indigo-border mb-6">
        <Plane size={13} className="text-indigo" />
        <span className="text-xs font-bold text-indigo tracking-wide uppercase">Our Story</span>
      </div>

      <h1
        className="font-black text-text-primary leading-[0.95]"
        style={{ fontSize: 'clamp(2.4rem, 5vw, 4.6rem)', letterSpacing: '-0.055em' }}
      >
        Travel further.
        <br />
        <span className="text-indigo">Adventure</span> more.
      </h1>

      <p className="mt-5 text-base md:text-lg text-text-muted leading-7 max-w-[48ch]">
        FlexBook flips the fixed round-trip model. We find the cheapest available flight from wherever you
        are right now, then let you keep going — the cheapest next hop, one tap at a time.
      </p>

      <ul className="mt-6 space-y-2.5">
        {HIGHLIGHTS.map((h) => (
          <li key={h.text} className="flex items-center gap-3 text-sm text-text-muted">
            <span className="w-8 h-8 rounded-xl bg-surface border border-border flex items-center justify-center shrink-0">
              {h.icon}
            </span>
            {h.text}
          </li>
        ))}
      </ul>
    </div>
  );

  const right = (
    <div className="section-shell p-6 text-center">
      <div
        className="w-16 h-16 rounded-[22px] flex items-center justify-center mb-5 mx-auto"
        style={{
          background: 'linear-gradient(135deg, rgba(79,70,229,0.12) 0%, rgba(79,70,229,0.06) 100%)',
          border: '1.5px solid rgba(79,70,229,0.18)',
        }}
      >
        <Rocket size={28} className="text-indigo" />
      </div>

      <h2 className="text-lg font-bold text-text-primary mb-1.5">Ready to explore?</h2>
      <p className="text-sm text-text-muted leading-6 mb-6 max-w-[34ch] mx-auto">
        Plan, price, and share a full multi-stop itinerary in seconds — no travel agent, no spreadsheet.
      </p>

      <Link
        to="/"
        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-indigo text-white text-sm font-bold hover:bg-indigo/90 transition-all active:scale-[0.98]"
        style={{ boxShadow: '0 10px 28px rgba(55,48,163,0.28)' }}
      >
        Start planning
        <ArrowRight size={15} />
      </Link>
      {!user && (
        <Link
          to="/signup"
          className="flex items-center justify-center gap-2 w-full mt-2.5 py-3.5 rounded-2xl border border-border text-sm font-semibold text-text-primary hover:bg-surface-2 transition-all"
        >
          Create free account
        </Link>
      )}
    </div>
  );

  return (
    <MarketingShell
      active="about"
      title="About Us"
      description="FlexBook is built for people who travel for the adventure, not just the destination. Discover multi-stop flights at the lowest available fare."
      onMenuOpen={onMenuOpen}
      left={left}
      right={right}
    />
  );
}
