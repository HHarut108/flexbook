import { useLocation, Link } from 'react-router-dom';
import { ArrowRight, Compass, Home } from 'lucide-react';
import { MarketingShellV2 } from '../components/MarketingShellV2';

interface Props {
  onMenuOpen?: () => void;
}

export function NotFoundScreen({ onMenuOpen }: Props) {
  const { pathname } = useLocation();

  return (
    <MarketingShellV2
      active="home"
      title="Page not found"
      description="That page doesn't exist on Flexbook. Head back to start planning."
      onMenuOpen={onMenuOpen}
    >
      <section className="max-w-3xl mx-auto px-5 md:px-8 lg:px-10 py-16 md:py-24 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-soft border border-indigo-border mb-7">
          <Compass size={28} className="text-indigo" />
        </div>

        <p className="text-[11px] md:text-xs font-extrabold tracking-[0.14em] text-orange uppercase mb-3">
          404 · Off the map
        </p>

        <h1
          className="font-black text-text-primary leading-[0.95] mb-5"
          style={{ fontSize: 'clamp(2.4rem, 5vw, 4rem)', letterSpacing: '-0.04em' }}
        >
          We couldn't find that page.
        </h1>

        <p className="text-base md:text-lg text-text-muted leading-7 max-w-[46ch] mx-auto mb-3">
          The link <code className="px-1.5 py-0.5 rounded bg-surface-2 border border-border text-[13px] text-text-secondary">{pathname}</code> doesn't match any Flexbook screen.
          It may have been moved, mistyped, or never existed.
        </p>

        <p className="text-sm text-text-muted mb-9">
          Jump back home and pick a tool to start planning.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-indigo text-white text-sm font-bold hover:bg-indigo/90 transition-all active:scale-[0.98]"
            style={{ boxShadow: '0 10px 28px rgba(55,48,163,0.28)' }}
          >
            <Home size={15} />
            Back to home
          </Link>
          <Link
            to="/about"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl border border-border text-sm font-semibold text-text-primary hover:bg-surface-2 transition-all"
          >
            How Flexbook works
            <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    </MarketingShellV2>
  );
}

export default NotFoundScreen;
