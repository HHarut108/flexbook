import { lazy, Suspense, useState } from 'react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useNavigate } from 'react-router-dom';
import { FlightOption } from '@fast-travel/shared';
import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { formatPrice, totalPrice } from '../utils/price.utils';
import { countryDisplayName } from '../utils/country.utils';
import { formatDate } from '../utils/date.utils';
import { TripTimeline } from '../components/TripTimeline';
import { PlanStayNudge } from '../components/PlanStayNudge';
import { DestinationGuideCard } from '../components/DestinationGuideCard';
import { MapErrorBoundary } from '../components/MapErrorBoundary';
import { WhenToFlyHomeModal } from '../components/WhenToFlyHomeModal';
import { ArrowLeft, Ticket } from 'lucide-react';
import { getDecisionHeadline } from '../utils/copy.utils';

const TripMap = lazy(() =>
  import('../components/TripMap').then((m) => ({ default: m.TripMap })),
);

export function DecisionScreen() {
  const navigate = useNavigate();
  const origin = useTripStore((s) => s.origin);
  const legs = useTripStore((s) => s.legs);
  const passengers = useTripStore((s) => s.passengers);
  const addLeg = useTripStore((s) => s.addLeg);
  const finalize = useTripStore((s) => s.finalize);
  const canContinue = useTripStore((s) => s.canContinue());
  const { setSelectedDate } = useSessionStore();
  const [planVisited, setPlanVisited] = useState(false);
  const [whenToFlyOpen, setWhenToFlyOpen] = useState(false);

  const nonReturnLegs = legs.filter((l) => !l.isReturn);
  const lastLeg = nonReturnLegs.at(-1)!;
  const tripTotal = totalPrice(nonReturnLegs);
  const stayNights = lastLeg.stayDurationDays ?? 1;
  const checkin = lastLeg.arrivalDatetime ? lastLeg.arrivalDatetime.slice(0, 10) : undefined;
  const checkout = lastLeg.nextDepartureDate ?? undefined;

  function handleContinue() {
    if (lastLeg.nextDepartureDate) {
      setSelectedDate(lastLeg.nextDepartureDate);
    }
    navigate('/flights');
  }

  function handleWrapUp() {
    // Open the cheapest-day modal first as decision-support. The user can either
    // accept the suggested cheapest flight, or click "See more options" to open
    // the full /return picker.
    setWhenToFlyOpen(true);
  }

  function handleSeeMoreReturnOptions() {
    setWhenToFlyOpen(false);
    navigate('/return');
  }

  function handleAcceptHomeFlight(flight: FlightOption) {
    addLeg({
      ...flight,
      stopIndex: nonReturnLegs.length + 1,
      stayDurationDays: 0,
      nextDepartureDate: '',
      isReturn: true,
    });
    finalize();
    setWhenToFlyOpen(false);
    navigate('/itinerary');
  }

  useDocumentTitle(`What's next from ${lastLeg.destinationCity}? · FlexBook`);

  return (
    <div className="px-4 pb-8 pt-4 md:flex md:gap-6 md:px-8 md:pt-8 md:pb-8 md:max-w-5xl lg:max-w-6xl xl:max-w-7xl md:mx-auto lg:gap-8 lg:px-10 lg:pt-10 lg:pb-10 md:items-start">
      {/* Left: hero panel */}
      <div className="md:flex-1">
        <div className="hero-panel mb-5">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => navigate('/hop-planner')}
              className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white border border-border hover:bg-indigo-soft hover:border-indigo-border transition-all text-text-muted shrink-0"
              aria-label="Back to Trip Builder"
            >
              {/* QA back-loop fix:
                  Previously navigated to /stay, which formed a triangle:
                    /flights (leg N+1) → /review → /stay → /flights
                  Each back press cycled through the same three screens with
                  the previously-selected flight still in the session store,
                  giving the user the impression they were "stuck" with the
                  last selection. Re-pointing the in-app back arrow at the
                  Trip Builder home gives a single, reliable escape hatch.
                  Edit-stay-duration is still reachable via the timeline
                  entry below; this button is just the "get me out of this
                  flow" affordance. */}
              <ArrowLeft size={18} />
            </button>
            <span className="pill-brand">Stop {nonReturnLegs.length}</span>
          </div>
          <h2 className="text-2xl font-bold text-text-primary mb-1">
            {getDecisionHeadline(lastLeg.destinationCity, lastLeg.flightId)}
          </h2>
          <p className="text-sm leading-6 text-text-muted">
            From here, you can keep the trip going by choosing your next destination or wrap it up
            and head home.
          </p>
        </div>

        {/* Trip timeline — always visible. Grouped with the "Get tickets so far"
            link below so the trip-summary cluster reads as one block. */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-text-muted uppercase tracking-wide">Trip so far</p>
            <span className="font-mono text-orange text-sm font-bold">{formatPrice(tripTotal)}</span>
          </div>
          <TripTimeline legs={legs} highlightLast />
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => navigate('/book/partial')}
              className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-indigo underline-offset-2 hover:underline transition-colors"
            >
              <Ticket size={12} /> Get tickets for flights so far
            </button>
          </div>
        </div>

        {/* Desktop-only trip route map */}
        {origin && nonReturnLegs.length > 0 && (
          <div className="hidden md:block mb-5">
            <p className="text-[10px] text-text-muted uppercase tracking-wide mb-2">Route so far</p>
            <div className="relative h-[280px] lg:h-[340px] rounded-2xl overflow-hidden border border-border bg-surface-2/30 shadow-[0_4px_16px_rgba(15,23,42,0.08)]">
              <MapErrorBoundary>
                <Suspense
                  fallback={
                    <div className="h-full flex items-center justify-center text-text-muted text-xs animate-pulse">
                      Loading map…
                    </div>
                  }
                >
                  <TripMap origin={origin} legs={nonReturnLegs} />
                </Suspense>
              </MapErrorBoundary>
            </div>
          </div>
        )}
      </div>

      {/* Right: nudge / inline guide + action buttons */}
      <div className="md:w-[300px] lg:w-[420px] xl:w-[460px] md:flex-shrink-0">
        {/* Plan stay nudge — mobile only; desktop shows the inline guide card below */}
        {(lastLeg.stayDurationDays ?? 0) >= 1 && (
          <div className="mb-5 md:hidden">
            <PlanStayNudge
              city={lastLeg.destinationCity}
              nights={lastLeg.stayDurationDays ?? 1}
              visited={planVisited}
              onTap={() => {
                setPlanVisited(true);
                navigate('/plan');
              }}
            />
          </div>
        )}

        {/* Desktop-only inline destination guide */}
        {(lastLeg.stayDurationDays ?? 0) >= 1 && (
          <div className="hidden md:block mb-5">
            <DestinationGuideCard
              city={lastLeg.destinationCity}
              country={countryDisplayName(lastLeg.destinationCountry)}
              nights={stayNights}
              checkin={checkin}
              checkout={checkout}
              passengers={passengers}
              onOpenFullGuide={() => {
                setPlanVisited(true);
                navigate('/plan');
              }}
            />
          </div>
        )}

        {/* Action buttons. The "Continue from {city} / Find the cheapest" framing
            sits directly above its CTA so the prompt and the action read as one
            grouped commitment. */}
        <div className="space-y-3">
          {canContinue && (
            <div className="rounded-2xl bg-indigo-soft border border-indigo-border px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted mb-1">
                Continue from {lastLeg.destinationCity}
              </p>
              <p className="text-text-primary font-semibold">
                Find the cheapest next destination on {formatDate(lastLeg.nextDepartureDate)}
              </p>
            </div>
          )}
          {canContinue ? (
            <button className="btn-primary" onClick={handleContinue}>
              Continue to the next destination
            </button>
          ) : (
            <p className="text-center text-text-muted text-sm mb-2">
              This trip has reached the current stop limit.
            </p>
          )}
          <button className="btn-secondary" onClick={handleWrapUp}>
            Wrap up and fly home
          </button>
        </div>
      </div>

      {origin && (
        <WhenToFlyHomeModal
          isOpen={whenToFlyOpen}
          onClose={() => setWhenToFlyOpen(false)}
          fromIata={lastLeg.destinationIata}
          fromCity={lastLeg.destinationCity}
          toIata={origin.iata}
          toCity={origin.city.name}
          arrivalDatetime={lastLeg.arrivalDatetime}
          nextDepartureDate={lastLeg.nextDepartureDate}
          passengers={passengers}
          onSelect={handleAcceptHomeFlight}
          onSeeMoreOptions={handleSeeMoreReturnOptions}
        />
      )}
    </div>
  );
}
