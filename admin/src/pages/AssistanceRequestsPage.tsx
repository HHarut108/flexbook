import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle, Headphones, ChevronDown, ChevronUp, User, Mail, Phone, MapPin } from 'lucide-react';
import { fetchAssistanceRequests, type AssistanceRequest } from '../api/metrics';

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatPrice(cents: number): string {
  if (!cents) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
}

function RequestRow({ request }: { request: AssistanceRequest }) {
  const [expanded, setExpanded] = useState(false);
  const { tripData } = request;
  const route = tripData.cities?.length > 0 ? tripData.cities.join(' → ') : '—';

  return (
    <div className="admin-card" style={{ marginBottom: '12px', overflow: 'hidden' }}>
      {/* Summary row */}
      <button
        className="w-full flex items-start gap-4 text-left"
        onClick={() => setExpanded((v) => !v)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '16px' }}
      >
        <div className="admin-stat-icon shrink-0" style={{ marginTop: '2px' }}>
          <Headphones size={16} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <span className="font-semibold" style={{ color: 'var(--admin-text)' }}>
              {request.fullName}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--admin-text-muted)', whiteSpace: 'nowrap' }}>
              {formatDateTime(request.createdAt)}
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--admin-text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {route}
          </p>
          <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: '6px', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Mail size={11} /> {request.email}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--admin-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Phone size={11} /> {request.phone}
            </span>
            {tripData.totalPrice > 0 && (
              <span style={{ fontSize: '12px', color: 'var(--admin-accent)', fontWeight: 600 }}>
                {formatPrice(tripData.totalPrice)}
              </span>
            )}
          </div>
        </div>

        <div style={{ color: 'var(--admin-text-muted)', flexShrink: 0, marginTop: '2px' }}>
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </div>
      </button>

      {/* Expanded details */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--admin-border)', padding: '16px', background: 'var(--admin-bg)' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--admin-text-muted)', marginBottom: '12px' }}>
            Contact details
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <User size={13} style={{ color: 'var(--admin-text-muted)', marginTop: '2px', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--admin-text-muted)', marginBottom: '1px' }}>Name</p>
                <p style={{ fontSize: '13px', color: 'var(--admin-text)', fontWeight: 500 }}>{request.fullName}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <Mail size={13} style={{ color: 'var(--admin-text-muted)', marginTop: '2px', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--admin-text-muted)', marginBottom: '1px' }}>Email</p>
                <a href={`mailto:${request.email}`} style={{ fontSize: '13px', color: 'var(--admin-accent)', fontWeight: 500 }}>{request.email}</a>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <Phone size={13} style={{ color: 'var(--admin-text-muted)', marginTop: '2px', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--admin-text-muted)', marginBottom: '1px' }}>Phone</p>
                <a href={`tel:${request.phone}`} style={{ fontSize: '13px', color: 'var(--admin-accent)', fontWeight: 500 }}>{request.phone}</a>
              </div>
            </div>
          </div>

          <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--admin-text-muted)', marginBottom: '12px' }}>
            Trip information
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {tripData.origin && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <MapPin size={13} style={{ color: 'var(--admin-text-muted)', marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--admin-text-muted)', marginBottom: '1px' }}>Origin</p>
                  <p style={{ fontSize: '13px', color: 'var(--admin-text)', fontWeight: 500 }}>{tripData.origin}</p>
                </div>
              </div>
            )}
            {tripData.cities?.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', gridColumn: 'span 2' }}>
                <MapPin size={13} style={{ color: 'var(--admin-text-muted)', marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--admin-text-muted)', marginBottom: '1px' }}>Route</p>
                  <p style={{ fontSize: '13px', color: 'var(--admin-text)', fontWeight: 500 }}>{route}</p>
                </div>
              </div>
            )}
            {tripData.totalPrice > 0 && (
              <div>
                <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--admin-text-muted)', marginBottom: '1px' }}>Est. total</p>
                <p style={{ fontSize: '13px', color: 'var(--admin-accent)', fontWeight: 700 }}>{formatPrice(tripData.totalPrice)}</p>
              </div>
            )}
            <div>
              <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--admin-text-muted)', marginBottom: '1px' }}>Flights</p>
              <p style={{ fontSize: '13px', color: 'var(--admin-text)', fontWeight: 500 }}>{Array.isArray(tripData.legs) ? tripData.legs.length : 0} leg{tripData.legs?.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AssistanceRequestsPage() {
  const [requests, setRequests] = useState<AssistanceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchAssistanceRequests();
      setRequests(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="admin-page">
      {/* Header */}
      <div className="admin-page__header">
        <div>
          <h1 className="admin-page__title">Assistance Requests</h1>
          <p className="admin-page__subtitle">
            Users who requested booking help — {requests.length} total
          </p>
        </div>
        <button
          className="admin-btn admin-btn--secondary"
          onClick={load}
          disabled={loading}
          aria-label="Refresh"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="admin-alert admin-alert--error" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && requests.length === 0 && (
        <div className="admin-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Headphones size={32} style={{ color: 'var(--admin-text-muted)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--admin-text-muted)', fontSize: '14px' }}>
            No assistance requests yet.
          </p>
        </div>
      )}

      {/* Requests list */}
      {requests.map((r) => (
        <RequestRow key={r.id} request={r} />
      ))}
    </div>
  );
}
