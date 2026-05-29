import { Link } from 'react-router-dom';
import { ArrowRight, Bell, Plane, Star } from 'lucide-react';
import { MarketingShell } from '../components/MarketingShell';

interface Props {
  title: string;
  description: string;
  onMenuOpen?: () => void;
}

export function ComingSoonScreen({ title, description, onMenuOpen }: Props) {
  const active = title === 'Deals' ? 'deals' : 'trips';

  const left = (
    <div className="max-w-xl">
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange/10 border border-orange/20 mb-5">
        <Star size={11} className="text-orange" />
        <span className="text-xs font-bold text-orange tracking-wide uppercase">Coming Soon</span>
      </div>

      <h1
        className="font-black text-text-primary leading-[0.95]"
        style={{ fontSize: 'clamp(2.6rem, 5.2vw, 4.6rem)', letterSpacing: '-0.055em' }}
      >
        {title}
      </h1>

      <p className="mt-5 text-base md:text-lg text-text-muted leading-7 max-w-[46ch]">
        {description}
      </p>
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
        <Plane size={28} className="text-indigo" />
      </div>

      <h2 className="text-lg font-bold text-text-primary mb-1.5">Be the first to know</h2>
      <p className="text-sm text-text-muted leading-6 mb-6 max-w-[34ch] mx-auto">
        {title} isn&apos;t live yet. In the meantime, you can start planning a multi-stop trip right now.
      </p>

      <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-surface-2 border border-border text-text-muted text-sm mb-2.5">
        <Bell size={15} className="text-indigo-mid shrink-0" />
        <span>We&apos;ll let you know when it&apos;s ready.</span>
      </div>

      <Link
        to="/"
        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-indigo text-white text-sm font-bold hover:bg-indigo/90 transition-all active:scale-[0.98]"
        style={{ boxShadow: '0 10px 28px rgba(55,48,163,0.28)' }}
      >
        Plan a trip now
        <ArrowRight size={15} />
      </Link>
    </div>
  );

  return (
    <MarketingShell
      active={active}
      title={title}
      onMenuOpen={onMenuOpen}
      left={left}
      right={right}
    />
  );
}
