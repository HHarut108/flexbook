import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  ExternalLink,
  Plane,
  Clock,
  Link2,
  AlertCircle,
  Inbox,
  User,
  Mail,
  Phone,
  MapPin,
  ArrowRight,
} from 'lucide-react';
import {
  fetchAssistanceRequests,
  AssistanceRequestSummary,
  TripLegSummary,
} from '../api/assistanceRequests';

const SHARE_BASE_URL = import.meta.env.VITE_FRONTEND_URL ?? 'https://flexbook.app';

function tripShareUrl(slug: string): string {
  return `${SHARE_BASE_URL}/share/${slug}`;
}

function formatPrice(usd: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(usd);
}

function totalFromLegs(legs: TripLegSummary[]): number {
  return legs.reduce((sum, l) => sum + (l.priceUsd ?? 0), 0);
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function FlightLegRow({ leg, index }: { leg: TripLegSummary; index: number }) {
  return (
    <div className="req-card__flight">
      <span className={`req-card__flight-badge ${leg.isReturn ? 'req-card__flight-badge--return' : 'req-card__flight-badge--outbound'}`}>
        {leg.isReturn ? 'R' : index + 1}
      </span>

      <div className="req-card__flight-route">
        <div className="req-card__flight-iata">
          <span className="req-card__flight-iata-code">{leg.originIata}</span>
          <span className="req-card__flight-iata-city">{leg.originCity}</span>
        </div>

        <div className="req-card__flight-middle">
          <div className="req-card__flight-line">
            <div className="req-card__flight-dash" />
            <Plane size={12} className="req-card__flight-plane-icon" />
            <div className="req-card__flight-dash" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
            <span className="req-card__flight-airline">{leg.airlineName}</span>
            {leg.stops === 0 && <span className="req-card__flight-direct">Direct</span>}
          </div>
        </div>

        <div className="req-card__flight-iata">
          <span className="req-card__flight-iata-code">{leg.destinationIata}</span>
          <span className="req-card__flight-iata-city">{leg.destinationCity}</span>
        </div>
      </div>

      <div className="req-card__flight-price-block">
        <span className="req-card__flight-price">{formatPrice(leg.priceUsd)}</span>
        <a href={leg.bookingUrl} target="_blank" rel="noopener noreferrer" className="req-card__book-btn">
          Book <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}

function RequestCard({ req }: { req: AssistanceRequestSummary }) {
  const { tripData, tripSlug, totalPrice, createdAt, fullName, email, phone } = req;
  const allLegs = [...(tripData.legs ?? [])].sort((a, b) => (a.stopIndex ?? 0) - (b.stopIndex ?? 0));
  const total = totalPrice > 0 ? totalPrice : totalFromLegs(allLegs);
  const shareUrl = tripShareUrl(tripSlug);
  const cities = tripData.cities?.length > 0 ? tripData.cities : [tripData.origin ?? '—'];
  const directCount = allLegs.filter(l => l.stops === 0).length;

  return (
    <div className="req-card">
      {/* Gradient header */}
      <div className="req-card__header">
        <div className="req-card__header-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="req-card__route">
              <MapPin size={13} className="req-card__route-icon" />
              {cities.map((city, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="req-card__city">{city}</span>
                  {i < cities.length - 1 && <ArrowRight size={11} className="req-card__route-arrow" />}
                </span>
              ))}
            </div>
            <p className="req-card__route-meta">
              {allLegs.length} flight{allLegs.length !== 1 ? 's' : ''} · {directCount} direct
            </p>
          </div>
          <div className="req-card__timestamp">
            <Clock size={11} className="req-card__timestamp-icon" />
            <span className="req-card__timestamp-text">{formatTimestamp(createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="req-card__body">
        {/* Contact */}
        <div>
          <p className="req-card__section-label">Contact</p>
          <div className="req-card__contact-grid">
            {([
              { icon: User, value: fullName },
              { icon: Mail, value: email },
              { icon: Phone, value: phone },
            ] as const).map(({ icon: Icon, value }) => (
              <div key={value} className="req-card__chip">
                <Icon size={13} className="req-card__chip-icon" />
                <span className="req-card__chip-text">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Share link */}
        <div className="req-card__share">
          <Link2 size={13} className="req-card__share-icon" />
          <span className="req-card__share-url">{shareUrl}</span>
          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className="req-card__share-link">
            Open <ExternalLink size={11} />
          </a>
        </div>

        {/* Flights */}
        {allLegs.length > 0 && (
          <div>
            <p className="req-card__section-label">Flights</p>
            <div className="req-card__flights">
              {allLegs.map((leg, i) => (
                <FlightLegRow key={leg.flightId ?? i} leg={leg} index={i} />
              ))}
            </div>
          </div>
        )}

        {/* Total */}
        <div className="req-card__total">
          <div>
            <p className="req-card__total-label">Estimated total</p>
            <p className="req-card__total-sub">All flights combined</p>
          </div>
          <span className="req-card__total-amount">{formatPrice(total)}</span>
        </div>
      </div>
    </div>
  );
}

export function AssistanceRequestsPage() {
  const [requests, setRequests] = useState<AssistanceRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAssistanceRequests();
      setRequests(data);
    } catch {
      setError('Failed to load assistance requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <h1 className="admin-page__title">Assistance Requests</h1>
          <p className="admin-page__subtitle">
            {loading ? '—' : `${requests.length} request${requests.length !== 1 ? 's' : ''} received`}
          </p>
        </div>
        <button
          className="admin-btn admin-btn--ghost"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="req-error">
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}

      {loading && requests.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="admin-card admin-spin" style={{ height: '220px', opacity: 0.4 }} />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="admin-card req-empty">
          <Inbox size={40} className="req-empty__icon" />
          <p className="req-empty__title">No assistance requests yet</p>
          <p className="req-empty__sub">Requests submitted from the app will appear here.</p>
        </div>
      ) : (
        requests.map((req) => <RequestCard key={req.id} req={req} />)
      )}
    </div>
  );
}
