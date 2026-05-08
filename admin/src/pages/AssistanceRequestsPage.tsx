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
  return `$${usd.toFixed(0)}`;
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

function RequestCard({ req }: { req: AssistanceRequestSummary }) {
  const { tripData, tripSlug, totalPrice, createdAt, fullName, email, phone } = req;
  const allLegs = [...(tripData.legs ?? [])].sort((a, b) => (a.stopIndex ?? 0) - (b.stopIndex ?? 0));
  // Use server-computed total; fall back to summing legs in case of old records
  const total = totalPrice > 0 ? totalPrice : totalFromLegs(allLegs);
  const shareUrl = tripShareUrl(tripSlug);

  const route = tripData.cities?.length > 0 ? tripData.cities.join(' → ') : (tripData.origin ?? '—');

  return (
    <div className="admin-card mb-5">
      {/* Header: route + timestamp */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-[var(--text-muted)] mb-1">Route</p>
          <p className="font-semibold text-[var(--text-primary)] text-sm leading-snug truncate">{route}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] shrink-0 mt-0.5">
          <Clock size={13} />
          <span>{formatTimestamp(createdAt)}</span>
        </div>
      </div>

      {/* Contact info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
        <div className="flex items-center gap-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2">
          <User size={13} className="text-[var(--text-muted)] shrink-0" />
          <span className="text-xs text-[var(--text-primary)] truncate">{fullName}</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2">
          <Mail size={13} className="text-[var(--text-muted)] shrink-0" />
          <span className="text-xs text-[var(--text-primary)] truncate">{email}</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2">
          <Phone size={13} className="text-[var(--text-muted)] shrink-0" />
          <span className="text-xs text-[var(--text-primary)] truncate">{phone}</span>
        </div>
      </div>

      {/* Trip share link */}
      <div className="flex items-center gap-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2.5 mb-4">
        <Link2 size={14} className="text-[var(--accent)] shrink-0" />
        <span className="text-xs font-mono text-[var(--accent)] truncate flex-1">{shareUrl}</span>
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:opacity-80 transition-opacity"
        >
          Open <ExternalLink size={12} />
        </a>
      </div>

      {/* Flight list */}
      {allLegs.length > 0 && (
        <>
          <p className="text-xs uppercase tracking-widest text-[var(--text-muted)] mb-2">Flights</p>
          <div className="space-y-2 mb-4">
            {allLegs.map((leg, i) => (
              <div
                key={leg.flightId ?? i}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"
              >
                <span
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0 ${
                    leg.isReturn ? 'bg-orange-500' : 'bg-[var(--accent)]'
                  }`}
                >
                  {leg.isReturn ? 'R' : i + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm font-bold text-[var(--text-primary)]">{leg.originIata}</span>
                    <Plane size={11} className="text-[var(--text-muted)]" />
                    <span className="font-mono text-sm font-bold text-[var(--text-primary)]">{leg.destinationIata}</span>
                    {leg.stops === 0 && (
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                        Direct
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
                    {leg.airlineName} · {leg.originCity} → {leg.destinationCity}
                  </p>
                </div>

                <span className="font-mono text-sm font-bold text-[var(--text-primary)] shrink-0">
                  {formatPrice(leg.priceUsd)}
                </span>

                <a
                  href={leg.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1 text-xs font-semibold text-[var(--accent)] border border-[var(--border)] hover:border-[var(--accent)] px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
                >
                  Buy <ExternalLink size={12} />
                </a>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Estimated total — always computed server-side from legs */}
      <div className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] border border-[var(--border)] px-4 py-3">
        <span className="text-sm font-semibold text-[var(--text-primary)]">Estimated total</span>
        <span className="font-mono text-base font-bold text-orange-500">{formatPrice(total)}</span>
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
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3 mb-5 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      {loading && requests.length === 0 ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="admin-card animate-pulse" style={{ height: '220px' }} />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="admin-card flex flex-col items-center justify-center py-16 text-center">
          <Inbox size={40} className="text-[var(--text-muted)] mb-4" />
          <p className="font-semibold text-[var(--text-primary)] mb-1">No assistance requests yet</p>
          <p className="text-sm text-[var(--text-muted)]">Requests submitted from the app will appear here.</p>
        </div>
      ) : (
        requests.map((req) => <RequestCard key={req.id} req={req} />)
      )}
    </div>
  );
}
