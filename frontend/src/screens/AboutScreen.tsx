import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { GoHomeLogo } from '../components/GoHomeLogo';
import { Plane, Globe, Zap, Shield, ArrowRight, User } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';

interface Props {
  onMenuOpen?: () => void;
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div
      className="bg-white/70 backdrop-blur-sm rounded-[20px] border border-border/60 p-6"
      style={{ boxShadow: '0 8px 28px -10px rgba(15,23,42,0.12)' }}
    >
      <div className="w-11 h-11 rounded-2xl bg-indigo-soft border border-indigo-border flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-base font-bold text-text-primary mb-2">{title}</h3>
      <p className="text-sm text-text-muted leading-6">{body}</p>
    </div>
  );
}

export function AboutScreen({ onMenuOpen }: Props) {
  const user = useAuthStore((s) => s.user);
  const initials = user ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase() : null;

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Helmet>
        <title>About Us — FlexBook</title>
        <meta
          name="description"
          content="FlexBook is built for people who travel for the adventure, not just the destination. Discover multi-stop flights at the lowest available fare."
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
            to="/about"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-indigo bg-indigo-soft border border-indigo-border transition-all"
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

      {/* Hero section */}
      <div className="relative max-w-4xl mx-auto px-5 pt-16 pb-12 md:px-8 lg:px-10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-soft border border-indigo-border mb-6">
          <Plane size={13} className="text-indigo" />
          <span className="text-xs font-bold text-indigo tracking-wide uppercase">Our Story</span>
        </div>

        <h1
          className="font-black text-text-primary mb-6 leading-[0.95]"
          style={{ fontSize: 'clamp(2.4rem, 5.5vw, 5rem)', letterSpacing: '-0.055em' }}
        >
          Travel further.
          <br />
          <span className="text-indigo">Adventure</span> more.
        </h1>

        <p className="text-lg md:text-xl text-text-muted leading-8 max-w-[52ch] mx-auto">
          FlexBook was built for people who believe the journey is the destination. We make it effortless to hop between cities, explore new corners of the world, and always pay the lowest possible fare — with zero bureaucracy.
        </p>
      </div>

      {/* Mission statement */}
      <div className="relative max-w-4xl mx-auto px-5 pb-16 md:px-8 lg:px-10">
        <div
          className="rounded-[28px] p-8 md:p-12 mb-14"
          style={{
            background: 'linear-gradient(135deg, rgba(55,48,163,0.97) 0%, rgba(79,70,229,0.97) 100%)',
          }}
        >
          <p
            className="font-black text-white leading-[1.05] mb-6"
            style={{ fontSize: 'clamp(1.6rem, 3.5vw, 3rem)', letterSpacing: '-0.04em' }}
          >
            "The cheapest next hop,<br />one tap at a time."
          </p>
          <p className="text-white/75 text-base md:text-lg leading-7 max-w-[52ch]">
            Traditional booking sites are built around fixed round-trips. FlexBook flips that model — we find the cheapest available flight from wherever you are right now, then let you keep going. No destination required. No return date needed. Just you, the world, and the best available fare.
          </p>
        </div>

        {/* Feature grid */}
        <h2
          className="font-black text-text-primary mb-8 text-center"
          style={{ fontSize: 'clamp(1.6rem, 3vw, 2.6rem)', letterSpacing: '-0.04em' }}
        >
          What makes FlexBook different
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          <FeatureCard
            icon={<Zap size={20} className="text-orange" />}
            title="Always the cheapest hop"
            body="Every single leg is sourced in real time. We never inflate prices or hide fees — what you see is what you pay."
          />
          <FeatureCard
            icon={<Globe size={20} className="text-indigo" />}
            title="Multi-stop by default"
            body="Plan up to 15 stops in a single trip. Start in one city, end wherever the adventure takes you."
          />
          <FeatureCard
            icon={<Plane size={20} className="text-sky-500" />}
            title="No fixed destination"
            body="You don't need to know where you're going. Search from your origin and let the cheapest options inspire your route."
          />
          <FeatureCard
            icon={<Shield size={20} className="text-emerald" />}
            title="No account required"
            body="Plan, price, and share a full itinerary without signing up. Your trip lives in the URL — private and portable."
          />
        </div>

        {/* Values */}
        <div className="text-center mb-14">
          <h2
            className="font-black text-text-primary mb-4"
            style={{ fontSize: 'clamp(1.6rem, 3vw, 2.6rem)', letterSpacing: '-0.04em' }}
          >
            Built for adventurers
          </h2>
          <p className="text-base md:text-lg text-text-muted leading-7 max-w-[56ch] mx-auto mb-8">
            Whether you're a digital nomad chasing the cheapest next base, a backpacker stretching every dollar, or a weekend wanderer squeezing in one more city — FlexBook is the tool that gets out of your way and lets you explore. We handle the logistics; you handle the memories.
          </p>
          <p className="text-base text-text-muted leading-7 max-w-[52ch] mx-auto">
            We believe great travel shouldn't require a travel agent, a complicated itinerary spreadsheet, or a return ticket you'll never use. FlexBook compresses all of that into a single, fast, intuitive interface — available anywhere, on any device, in seconds.
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-indigo text-white text-sm font-bold hover:bg-indigo/90 transition-all active:scale-95"
            style={{ boxShadow: '0 10px 28px rgba(55,48,163,0.28)' }}
          >
            Start planning
            <ArrowRight size={15} />
          </Link>
          {!user && (
            <Link
              to="/signup"
              className="flex items-center gap-2 px-7 py-3.5 rounded-2xl border border-border text-sm font-semibold text-text-primary hover:bg-surface-2 transition-all"
            >
              Create free account
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
