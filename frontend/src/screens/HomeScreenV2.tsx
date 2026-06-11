import { Send, Wallet } from 'lucide-react';
import { MarketingShellV2 } from '../components/MarketingShellV2';
import { HomeHubCard } from '../components/HomeHubCard';
import { HomeTestimonialBlock } from '../components/HomeTestimonialBlock';
import { ToolCard } from '../components/ToolCard';
import { ViewTransitionLink } from '../components/ViewTransitionLink';
import { TOOLS_V2 } from './ToolsScreen';
import { useAuthStore } from '../store/auth.store';
import { intentPrefetch } from '../lib/routePrefetch';

interface Props {
  onMenuOpen?: () => void;
}

/**
 * V2 home — hub-style landing. Hero (left: tagline + stats; right: tool hub),
 * "four tools, one job" row, real-routes testimonial, "Ready when you are" CTA.
 * No search form on this page — visitors pick a tool first.
 */
export function HomeScreenV2({ onMenuOpen }: Props) {
  const user = useAuthStore((s) => s.user);
  return (
    <MarketingShellV2
      active="home"
      title="Flexbook"
      description="Travel more. Learn more. Spend less. Chain the cheapest multi-stop flights across Europe — no account, ever."
      onMenuOpen={onMenuOpen}
    >
      {/* ============ HERO ============ */}
      <section className="max-w-6xl xl:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 pt-4 md:pt-16 lg:pt-20 pb-6 md:pb-16">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-5 lg:gap-16 items-start">
          {/* Left — copy. Minimal on mobile: just the tagline + one-line
              subhead. Stats are decorative — they stay on desktop where there's
              room, but disappear on phone so the hub card surfaces sooner. */}
          <div>
            {/* Dash + badge — matches the V1 tool-page hero pattern */}
            <div className="flex items-center gap-2 mb-3 md:mb-4">
              <div className="h-0.5 w-5 bg-orange rounded-full" />
              <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.14em] text-orange">
                Flexbook · Your travel toolkit
              </p>
            </div>

            {user && (
              <p
                className="text-text-secondary font-semibold mb-1.5 md:mb-2"
                style={{ fontSize: 'clamp(1rem, 1.6vw, 1.5rem)', letterSpacing: '-0.01em' }}
              >
                Hi {user.firstName} 👋
              </p>
            )}

            <h1
              className="font-black text-text-primary leading-[0.95]"
              style={{ fontSize: 'clamp(1.6rem, 6vw, 5rem)', letterSpacing: '-0.06em' }}
            >
              Travel&nbsp;more.<br />
              Learn&nbsp;more.<br />
              <span className="relative inline-block">
                Spend&nbsp;<span className="text-indigo">less</span>
                <span
                  className="absolute -right-[0.4em] -top-[0.15em] font-black text-orange select-none"
                  style={{ fontSize: '1.6em', lineHeight: 1 }}
                  aria-hidden
                >
                  .
                </span>
              </span>
            </h1>

            <p className="mt-3 md:mt-6 text-[13px] md:text-lg text-text-muted leading-5 md:leading-7 max-w-[48ch]">
              Flexible by design. Cheaper by default. Live fares, flex dates,
              open-ended trips — no account, no upsell, no markup.
            </p>

            {/* Stats: desktop only. */}
            <div className="hidden md:flex items-end gap-12 mt-9">
              <Stat value="60s" label="to design a full trip" />
              <Stat value="4 tools" label="one toolkit" />
              <Stat value="1000s" label="of cheap routes, daily" />
            </div>
          </div>

          {/* Right — hub card */}
          <div className="lg:pt-2">
            <HomeHubCard tools={TOOLS_V2} />
          </div>
        </div>
      </section>

      {/* ============ FOUR TOOLS, ONE JOB ============ */}
      <section className="max-w-6xl xl:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 mt-6 md:mt-12">
        <div className="text-center mb-8 md:mb-12">
          <h2
            className="font-black text-text-primary leading-tight"
            style={{ fontSize: 'clamp(1.5rem, 4.4vw, 3.4rem)', letterSpacing: '-0.04em' }}
          >
            Cheaper flights. Bigger trips. Zero markup.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {TOOLS_V2.map((tool) => (
            <ToolCard key={tool.id} tool={tool} variant="compact" />
          ))}
        </div>
      </section>

      {/* ============ TESTIMONIAL + ROUTES ============ */}
      <HomeTestimonialBlock />

      {/* ============ FINAL CTA ============ */}
      <section className="max-w-6xl xl:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 mt-14 md:mt-24 mb-8 text-center">
        <h2
          className="font-black text-text-primary leading-tight mb-3 md:mb-4"
          style={{ fontSize: 'clamp(1.5rem, 4.2vw, 3rem)', letterSpacing: '-0.035em' }}
        >
          Ready when you are.
        </h2>
        <p className="text-sm md:text-lg text-text-muted mb-6 md:mb-8">
          Pick a tool and start — you'll be looking at prices in seconds.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <ViewTransitionLink
            to="/quick-search"
            {...intentPrefetch('/quick-search')}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-orange text-white text-sm font-bold hover:bg-orange-dark transition-all"
            style={{ boxShadow: '0 14px 32px -10px rgba(249,115,22,0.5)' }}
          >
            <Send size={15} />
            Explore flights
          </ViewTransitionLink>
          <ViewTransitionLink
            to="/trip-planner"
            {...intentPrefetch('/trip-planner')}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-surface border border-border text-sm font-bold text-text-primary hover:bg-surface-2 transition-all"
          >
            <Wallet size={15} />
            Plan by budget
          </ViewTransitionLink>
        </div>
      </section>
    </MarketingShellV2>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div
        className="font-black text-text-primary leading-none"
        style={{ fontSize: 'clamp(1.25rem, 2.8vw, 2.2rem)', letterSpacing: '-0.03em' }}
      >
        {value}
      </div>
      <div className="text-[11px] md:text-xs text-text-muted mt-1 md:mt-1.5 leading-tight">{label}</div>
    </div>
  );
}
