import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { formatPrice, totalPrice } from '../utils/price.utils';
import { formatDate } from '../utils/date.utils';
import { TripTimeline } from '../components/TripTimeline';
import { ArrowLeft, Ticket } from 'lucide-react';

export function DecisionScreen() {
  const legs = useTripStore((s) => s.legs);
  const canContinue = useTripStore((s) => s.canContinue());
  const { setScreen, setSelectedDate } = useSessionStore();

  const nonReturnLegs = legs.filter((l) => !l.isReturn);
  const lastLeg = nonReturnLegs.at(-1)!;
  const tripTotal = totalPrice(nonReturnLegs);

  function handleContinue() {
    if (lastLeg.nextDepartureDate) {
      setSelectedDate(lastLeg.nextDepartureDate);
    }
    setScreen('flight-results');
  }

  function handleGoHome() {
    setScreen('return-flights');
  }

  return (
    <div className="px-4 pb-8 pt-4">
      <div className="hero-panel mb-5">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => setScreen('stay-duration')}
            className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white border border-border hover:bg-indigo-soft hover:border-indigo-border transition-all text-text-muted shrink-0"
            aria-label="Back to stay duration"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="pill-brand">Stop {nonReturnLegs.length}</span>
        </div>
        <h2 className="text-2xl font-bold text-text-primary mb-1">
          {lastLeg.destinationCity} feels like a good chapter.
        </h2>
        <p className="text-sm leading-6 text-text-muted">
          From here, you can keep the trip going by choosing your next destination or wrap it up
          and head home.
        </p>
        <div className="mt-4 rounded-2xl bg-indigo-soft border border-indigo-border px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted mb-1">
            Continue from {lastLeg.destinationCity}
          </p>
          <p className="text-text-primary font-semibold">
            Find the cheapest next destination on {formatDate(lastLeg.nextDepartureDate)}
          </p>
        </div>
      </div>

      {/* Trip timeline — always visible */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-text-muted uppercase tracking-wide">Trip so far</p>
          <span className="font-mono text-orange text-sm font-bold">{formatPrice(tripTotal)}</span>
        </div>
        <TripTimeline legs={legs} highlightLast />
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        {canContinue ? (
          <button className="btn-primary" onClick={handleContinue}>
            Continue to the next destination
          </button>
        ) : (
          <p className="text-center text-text-muted text-sm mb-2">
            This trip has reached the current stop limit.
          </p>
        )}
        <button className="btn-secondary" onClick={handleGoHome}>
          Wrap up and fly home
        </button>
        <button
          className="btn-outline flex items-center justify-center gap-2"
          onClick={() => setScreen('partial-booking')}
        >
          <Ticket size={16} /> Get tickets for flights so far
        </button>
      </div>
    </div>
  );
}
