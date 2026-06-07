import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../store/session.store';
import { useTripStore } from '../store/trip.store';
import { computeNextDeparture, formatDateLong } from '../utils/date.utils';
import { formatPrice, totalPrice } from '../utils/price.utils';
import { countryDisplayName } from '../utils/country.utils';
import { ArrowLeft, ArrowRight, Minus, Plus, AlertTriangle, Waypoints, MapPin } from 'lucide-react';
import { TripTimeline } from '../components/TripTimeline';
import { DestinationGuideCard } from '../components/DestinationGuideCard';
import { getStayDurationHint } from '../utils/copy.utils';
import { useCurrentPassport } from '../hooks/useCurrentPassport';
import { useVisaCountries, resolveCountryCode } from '../hooks/useVisaCountries';
import { useVisaRequirements } from '../hooks/useVisaRequirements';
import recommendationsRaw from '../../public/stayRecommendations.json';
const recommendations = recommendationsRaw as Record<string, string>;

const QUICK_PICK_NIGHTS = [1, 3, 5, 7];

function formatRecommendation(text: string) {
  return text.replace(/^Typically\s+/i, 'A great first plan is ');
}

export function StayDurationScreen() {
  const navigate = useNavigate();
  const { selectedFlight, showToast } = useSessionStore();
  const legs = useTripStore((s) => s.legs);
  const addLeg = useTripStore((s) => s.addLeg);
  const passengers = useTripStore((s) => s.passengers);
  const [days, setDays] = useState(3);

  // Debounce the live `days` value before passing it to the destination
  // guide so quick +/- stepper clicks don't spam the /city-guide API.
  const [guideNights, setGuideNights] = useState(days);
  useEffect(() => {
    const t = setTimeout(() => setGuideNights(days), 350);
    return () => clearTimeout(t);
  }, [days]);

  // Look up visa info for the destination country so we can warn the user
  // when their planned stay exceeds the visa-free / on-arrival / eVisa window.
  // The hook is no-op when passport or country aren't resolved yet.
  const { passport } = useCurrentPassport();
  const { loaded: visaCountriesLoaded } = useVisaCountries();
  const destinationCode = useMemo(() => {
    if (!selectedFlight || !visaCountriesLoaded) return null;
    // The raw destinationCountry from the flights API may be e.g. "Turkey"
    // while passport-index keys on the official short name ("Türkiye"). Run
    // it through countryDisplayName so both sides agree.
    const normalized = countryDisplayName(selectedFlight.destinationCountry);
    return resolveCountryCode(normalized);
  }, [selectedFlight, visaCountriesLoaded]);
  const destCodeList = useMemo(() => [destinationCode], [destinationCode]);
  const visaResults = useVisaRequirements(passport, destCodeList);
  const visaEntry = destinationCode ? visaResults[destinationCode] : undefined;
  const visa = visaEntry?.status === 'ok' ? visaEntry.data : undefined;

  useEffect(() => {
    if (!selectedFlight) navigate('/flights', { replace: true });
  }, [selectedFlight, navigate]);

  if (!selectedFlight) return null;

  const nextDeparture = computeNextDeparture(selectedFlight.arrivalDatetime, days);
  const recommendation = recommendations[selectedFlight.destinationIata];
  const stopIndex = legs.filter((l) => !l.isReturn).length + 1;

  function handleConfirm() {
    if (!selectedFlight) return;
    addLeg({
      ...selectedFlight,
      stopIndex,
      stayDurationDays: days,
      nextDepartureDate: nextDeparture,
      isReturn: false,
    });
    showToast(`${selectedFlight.destinationCity} added! You're building something cool.`);
    navigate('/review');
  }

  const priorLegs = legs.filter((l) => !l.isReturn);
  const destinationCity = selectedFlight.destinationCity;
  const destinationCountryName = countryDisplayName(selectedFlight.destinationCountry);

  return (
    <div className="max-w-6xl xl:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 pt-6 md:pt-10 pb-10 md:pb-16">
      <Helmet><title>Stay in {destinationCity} · FlexBook</title></Helmet>

      {/* Two-column on lg+: hero on the left, picker card on the right. Mobile
          stacks them. Matches the V2 Trip Builder / Quick Search shells. */}
      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 lg:gap-10">
        {/* LEFT — hero */}
        <div>
          {/* Back chevron + step pill */}
          <div className="flex items-center gap-3 mb-5">
            <button
              onClick={() => navigate('/flights')}
              className="w-10 h-10 flex items-center justify-center rounded-2xl bg-surface border border-border hover:bg-indigo-soft hover:border-indigo-border transition-all text-text-muted shrink-0"
              aria-label="Back to flight options"
            >
              <ArrowLeft size={18} />
            </button>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-soft border border-indigo-border text-[11px] font-bold uppercase tracking-wider text-indigo">
              Stay and explore
            </span>
          </div>

          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-3">
            <div className="h-0.5 w-5 bg-orange rounded-full" />
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-orange">
              Flexbook tool · Stay duration
            </p>
          </div>

          {/* Big headline */}
          <h1
            className="leading-[0.92] font-black text-text-primary"
            style={{ fontSize: 'clamp(2.4rem, 4.6vw, 4.6rem)', letterSpacing: '-0.06em' }}
          >
            How long in
            <br />
            <span className="text-indigo">{destinationCity}</span>
            <span className="text-orange">?</span>
          </h1>

          <p className="mt-4 text-base md:text-lg leading-7 text-text-muted max-w-[44ch]">
            {getStayDurationHint(selectedFlight.flightId)}
          </p>

          <div className="mt-3 flex items-center gap-1.5 text-text-muted text-sm">
            <MapPin size={14} className="text-indigo-mid" />
            <span>{destinationCity}, {destinationCountryName}</span>
          </div>

          {recommendation && (
            <div className="mt-5 rounded-2xl bg-indigo-soft border border-indigo-border px-4 py-3 max-w-md">
              <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted mb-1 font-semibold">
                A helpful starting point
              </p>
              <p className="text-indigo text-sm leading-6">{formatRecommendation(recommendation)}</p>
            </div>
          )}

          {/* Trip so far — only render once we have at least one leg in store */}
          {priorLegs.length > 0 && (
            <div className="mt-6 pt-5 border-t border-border/60 max-w-md">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] text-text-muted uppercase tracking-[0.16em] font-semibold">
                  Trip so far
                </p>
                <span className="font-mono text-orange text-xs font-bold">
                  {formatPrice(totalPrice(priorLegs))}
                </span>
              </div>
              <TripTimeline legs={legs} highlightLast={false} />
            </div>
          )}

          {/* Desktop-only Stay/Do/Eat preview — gives the user a sense of
              what awaits them while they pick the duration. Hidden on mobile
              to keep the picker the primary action. */}
          <div className="hidden lg:block mt-8">
            <DestinationGuideCard
              city={destinationCity}
              country={destinationCountryName}
              nights={guideNights}
              checkin={selectedFlight.arrivalDatetime?.slice(0, 10)}
              checkout={nextDeparture}
              passengers={passengers}
            />
          </div>
        </div>

        {/* RIGHT — picker card */}
        <div
          className="bg-surface rounded-[24px] border border-border/60 p-5 md:p-6 self-start"
          style={{ boxShadow: '0 20px 50px -20px rgba(15,23,42,0.18)' }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-text-primary">Your stay</h2>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-2 border border-border text-[11px] font-bold text-text-secondary">
              <Waypoints size={11} />
              Stop {stopIndex}
            </span>
          </div>

          {/* Quick-select pills */}
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-1.5 px-1">
            Quick pick
          </div>
          <div className="grid grid-cols-4 gap-2 mb-5">
            {QUICK_PICK_NIGHTS.map((n) => (
              <button
                key={n}
                onClick={() => setDays(n)}
                className={`py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95 border
                  ${days === n
                    ? 'bg-indigo text-white border-indigo shadow-[0_8px_20px_rgba(79,70,229,0.28)]'
                    : 'bg-indigo-soft text-indigo border-indigo-border hover:border-indigo/50'
                  }
                `}
              >
                {n} {n === 1 ? 'day' : 'days'}
              </button>
            ))}
          </div>

          <hr className="border-border/60 my-5" />

          {/* Stepper */}
          <div className="flex items-center justify-center gap-6 md:gap-8 mb-1">
            <button
              onClick={() => setDays((d) => Math.max(1, d - 1))}
              className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-indigo-soft border border-indigo-border text-indigo hover:bg-indigo hover:text-white transition-all active:scale-90 flex items-center justify-center"
              aria-label="Decrease days"
            >
              <Minus size={22} />
            </button>
            <div className="text-center">
              <div className="text-5xl md:text-6xl font-bold font-mono text-text-primary tracking-tight leading-none">
                {days}
              </div>
              <div className="text-text-muted text-xs mt-1.5 uppercase tracking-[0.16em]">
                {days === 1 ? 'day' : 'days'}
              </div>
            </div>
            <button
              onClick={() => setDays((d) => Math.min(90, d + 1))}
              className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-indigo-soft border border-indigo-border text-indigo hover:bg-indigo hover:text-white transition-all active:scale-90 flex items-center justify-center"
              aria-label="Increase days"
            >
              <Plus size={22} />
            </button>
          </div>

          <hr className="border-border/60 my-5" />

          {/* Visa stay-length warning — fires when the planned nights exceed
              the visa-free / on-arrival / eVisa window for this passport×
              destination pair. Surfaces the limit before the user commits to a
              stay length that would require embassy paperwork. */}
          {visa && typeof visa.days === 'number' && days > visa.days && (
            <div
              role="alert"
              className="rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700/40 px-3.5 py-3 mb-5 flex items-start gap-2.5"
            >
              <AlertTriangle
                size={16}
                className="text-amber-600 dark:text-amber-300 shrink-0 mt-0.5"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 leading-tight">
                  Heads up — {days} days exceeds your visa-free window
                </p>
                <p className="text-[12px] text-amber-800 dark:text-amber-200/90 leading-snug mt-1">
                  Your {passport} passport allows up to{' '}
                  <strong>{visa.days} days</strong> in {destinationCountryName} as{' '}
                  <em>{visa.status}</em>. For longer stays you&apos;ll likely
                  need a different visa class — check the destination
                  country&apos;s consulate before committing.
                </p>
              </div>
            </div>
          )}

          {/* Departure preview */}
          <div className="rounded-2xl border border-border bg-surface-2/60 px-4 py-3 mb-5">
            <p className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-semibold">
              You&apos;ll depart {destinationCity} on
            </p>
            <p className="text-text-primary font-bold text-lg mt-1">
              {formatDateLong(nextDeparture)}
            </p>
          </div>

          {/* CTAs */}
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-4 rounded-full bg-orange text-white text-sm font-bold hover:bg-orange-dark transition-all"
            style={{ boxShadow: '0 12px 24px -8px rgba(249,115,22,0.45)' }}
          >
            Stay {days} {days === 1 ? 'day' : 'days'} and continue
            <ArrowRight size={14} />
          </button>
          <button
            type="button"
            onClick={() => navigate('/flights')}
            className="w-full mt-3 inline-flex items-center justify-center px-5 py-3 rounded-full bg-surface border border-border text-sm font-semibold text-text-secondary hover:bg-surface-2 hover:text-text-primary transition-all"
          >
            Back to flight options
          </button>
        </div>
      </div>
    </div>
  );
}
