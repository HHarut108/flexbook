import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTripStore } from '../store/trip.store';
import { useSessionStore } from '../store/session.store';
import { fetchTripShare } from '../api/trips.api';

export function ShareRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const loadFromItinerary = useTripStore((s) => s.loadFromItinerary);
  const showExpiredLinkModal = useSessionStore((s) => s.showExpiredLinkModal);

  useEffect(() => {
    // Support legacy ?trip=<id> format
    const legacyId = searchParams.get('trip');
    const id = slug ?? legacyId;

    if (!id) {
      navigate('/', { replace: true });
      return;
    }

    fetchTripShare(id).then((itinerary) => {
      if (!itinerary) {
        showExpiredLinkModal();
        navigate('/', { replace: true });
        return;
      }
      loadFromItinerary(itinerary);
      const target =
        itinerary.status === 'complete'
          ? '/itinerary'
          : itinerary.legs.length > 0
            ? '/review'
            : '/flights';
      navigate(target, { replace: true });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <p className="text-text-muted text-sm animate-pulse">Loading your trip…</p>
    </div>
  );
}
