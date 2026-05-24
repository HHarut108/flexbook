import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../store/session.store';
import { useTripStore } from '../store/trip.store';
import { computeNextDeparture, formatDateLong } from '../utils/date.utils';
import { formatPrice, totalPrice } from '../utils/price.utils';
import { countryDisplayName } from '../utils/country.utils';
import { ArrowLeft, Minus, Plus } from 'lucide-react';
import { TripTimeline } from '../components/TripTimeline';
import { getStayDurationHint } from '../utils/copy.utils';
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
  const [days, setDays] = useState(3);

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

  return (
    <div className="px-4 pb-8 pt-4 md:px-6 md:pt-8 md:pb-10 md:max-w-2xl md:mx-auto">
      <Helmet><title>Stay in {selectedFlight.destinationCity} · FlexBook</title></Helmet>

      {/* Hero panel */}
      <div className="hero-panel mb-5">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate('/flights')}
            className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white border border-border hover:bg-indigo-soft hover:border-indigo-border transition-all text-text-muted shrink-0"
            aria-label="Back to flight options"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="pill-sky inline-flex">Stay and explore</span>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-text-primary mb-1">
          How long do you want to stay in {selectedFlight.destinationCity}?
        </h2>
        <p className="text-sm leading-6 text-text-muted">
          {getStayDurationHint(selectedFlight.flightId)}
        </p>
        <p className="text-text-muted text-sm mt-3">
          {selectedFlight.destinationCity}, {countryDisplayName(selectedFlight.destinationCountry)}
        </p>
        {recommendation && (
          <div className="mt-3 rounded-2xl bg-indigo-soft border border-indigo-border px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted mb-1">
              A helpful starting point
            </p>
            <p className="text-indigo text-sm">{formatRecommendation(recommendation)}</p>
          </div>
        )}
      </div>

      {/* Trip progress if we already have at least one leg */}
      {priorLegs.length > 0 && (
        <div className="mb-5 pb-5 border-b border-border/50">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] text-text-muted uppercase tracking-wide">Trip so far</p>
            <span className="font-mono text-orange text-xs font-bold">
              {formatPrice(totalPrice(priorLegs))}
            </span>
          </div>
          <TripTimeline legs={legs} highlightLast={false} />
        </div>
      )}

      {/* Picker card — quick picks, stepper, departure preview, CTAs */}
      <div className="card">
        {/* Quick-select pills */}
        <p className="text-[10px] text-text-muted uppercase tracking-wide mb-2.5">Quick pick</p>
        <div className="flex gap-2 mb-6">
          {QUICK_PICK_NIGHTS.map((n) => (
            <button
              key={n}
              onClick={() => setDays(n)}
              className={`flex-1 py-3 rounded-2xl text-sm font-semibold transition-all active:scale-95 border
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

        {/* Stepper */}
        <div className="flex items-center justify-center gap-8 mb-6">
          <button
            onClick={() => setDays((d) => Math.max(1, d - 1))}
            className="w-14 h-14 rounded-2xl bg-indigo-soft border border-indigo-border text-indigo hover:bg-indigo hover:text-white transition-all active:scale-90 flex items-center justify-center"
            aria-label="Decrease days"
          >
            <Minus size={24} />
          </button>
          <div className="text-center">
            <div className="text-6xl font-bold font-mono text-text-primary tracking-tight">{days}</div>
            <div className="text-text-muted text-sm mt-1">{days === 1 ? 'day' : 'days'}</div>
          </div>
          <button
            onClick={() => setDays((d) => Math.min(90, d + 1))}
            className="w-14 h-14 rounded-2xl bg-indigo-soft border border-indigo-border text-indigo hover:bg-indigo hover:text-white transition-all active:scale-90 flex items-center justify-center"
            aria-label="Increase days"
          >
            <Plus size={24} />
          </button>
        </div>

        {/* Departure preview */}
        <div className="rounded-2xl border border-border bg-surface-2/60 text-center px-4 py-3 mb-5">
          <p className="text-text-muted text-sm">
            You&apos;ll depart {selectedFlight.destinationCity} on
          </p>
          <p className="text-text-primary font-semibold text-lg mt-1">
            {formatDateLong(nextDeparture)}
          </p>
        </div>

        <button className="btn-primary mb-3" onClick={handleConfirm}>
          Stay {days} {days === 1 ? 'day' : 'days'} and continue
        </button>
        <button className="btn-outline" onClick={() => navigate('/flights')}>
          Back to flight options
        </button>
      </div>
    </div>
  );
}
