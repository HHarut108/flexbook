import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Send, AlertCircle, CheckCircle2, Calendar, Filter } from 'lucide-react';
import {
  fetchMetricsHistory,
  fetchSessionMetrics,
  fetchAllTimeMetrics,
  fetchCacheMetrics,
  sendReport,
} from '../api/metrics';
import type {
  DayMetrics,
  SessionMetricsResponse,
  AllTimeMetricsResponse,
  CacheMetricsResponse,
} from '../api/metrics';
import { UsageChart } from '../components/UsageChart';
import { MetricsTable } from '../components/MetricsTable';
import { ApiHealthTable } from '../components/ApiHealthTable';

const SERVICE_COLORS: Record<string, string> = {
  'rapidapi-kiwi':  '#8B5CF6',
  'google-places':  '#10B981',
  openweathermap:   '#0EA5E9',
  airhex:           '#F59E0B',
  kiwi:             '#4F46E5',
  serpapi:          '#F97316',
};
const FALLBACK_COLORS = ['#EC4899', '#14B8A6', '#64748B', '#EF4444'];

function serviceColor(name: string, index: number): string {
  return SERVICE_COLORS[name] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function extractServices(history: DayMetrics[]): string[] {
  const set = new Set<string>();
  for (const day of history) {
    for (const k of Object.keys(day.calls)) set.add(k);
  }
  return Array.from(set).sort();
}

type ReportStatus = 'idle' | 'sending' | 'sent' | 'error';

export function ApiUsagePage() {
  const [from, setFrom] = useState(isoDaysAgo(13));
  const [to, setTo] = useState(isoToday());
  const [history, setHistory] = useState<DayMetrics[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [reportStatus, setReportStatus] = useState<ReportStatus>('idle');
  const [reportError, setReportError] = useState('');

  const [session, setSession] = useState<SessionMetricsResponse | null>(null);
  const [allTime, setAllTime] = useState<AllTimeMetricsResponse | null>(null);
  const [cacheMetrics, setCacheMetrics] = useState<CacheMetricsResponse | null>(null);

  const load = useCallback(async () => {
    if (from > to) return;
    setLoading(true);
    setFetchError('');
    try {
      const [histRes, sessionRes, allTimeRes, cacheRes] = await Promise.all([
        fetchMetricsHistory(from, to),
        fetchSessionMetrics(),
        fetchAllTimeMetrics(),
        fetchCacheMetrics(),
      ]);

      setHistory(histRes.history);
      setSession(sessionRes);
      setAllTime(allTimeRes);
      setCacheMetrics(cacheRes);

      const svcs = extractServices(histRes.history);
      setServices(svcs);
      setSelected((prev) => {
        const next = new Set(prev);
        if (prev.size === 0) {
          svcs.forEach((s) => next.add(s));
        } else {
          svcs.forEach((s) => { if (!prev.has(s)) next.add(s); });
        }
        return next;
      });
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load metrics.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleService(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        if (next.size > 1) next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === services.length) {
      setSelected(new Set(services.slice(0, 1)));
    } else {
      setSelected(new Set(services));
    }
  }

  async function handleSendReport() {
    setReportStatus('sending');
    setReportError('');
    try {
      const res = await sendReport({ from, to });
      setReportStatus(res.sent ? 'sent' : 'error');
      if (!res.sent) setReportError(res.error ?? 'Unknown error');
    } catch (err) {
      setReportStatus('error');
      setReportError(err instanceof Error ? err.message : 'Failed to send report.');
    }
    setTimeout(() => setReportStatus('idle'), 4000);
  }

  const filteredServices = services.filter((s) => selected.has(s));

  const totalCalls = history.reduce(
    (sum, d) => sum + filteredServices.reduce((s2, sv) => s2 + (d.calls[sv] ?? 0), 0),
    0,
  );

  const allSelected = selected.size === services.length;

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <h1 className="admin-page__title">API Usage</h1>
          <p className="admin-page__subtitle">
            Calls per service tracked in Upstash Redis
          </p>
        </div>
        <div className="admin-page__actions">
          <button
            className="admin-btn admin-btn--ghost"
            onClick={load}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'admin-spin' : ''} />
            Refresh
          </button>
          <button
            className={`admin-btn ${
              reportStatus === 'sending'
                ? 'admin-btn--ghost'
                : reportStatus === 'sent'
                ? 'admin-btn--success'
                : reportStatus === 'error'
                ? 'admin-btn--danger'
                : 'admin-btn--primary'
            }`}
            onClick={handleSendReport}
            disabled={reportStatus === 'sending'}
          >
            {reportStatus === 'sent' ? (
              <CheckCircle2 size={15} />
            ) : reportStatus === 'error' ? (
              <AlertCircle size={15} />
            ) : (
              <Send size={15} />
            )}
            {reportStatus === 'sending'
              ? 'Sending…'
              : reportStatus === 'sent'
              ? 'Sent!'
              : reportStatus === 'error'
              ? 'Failed'
              : 'Send Report'}
          </button>
        </div>
      </div>

      {reportStatus === 'error' && reportError && (
        <div className="admin-alert admin-alert--error">
          <AlertCircle size={15} />
          {reportError}
        </div>
      )}

      {fetchError && (
        <div className="admin-alert admin-alert--error">
          <AlertCircle size={15} />
          {fetchError}
        </div>
      )}

      {/* API Health breakdown — session + alltime with primary/fallback */}
      <div className="admin-card">
        <h2 className="admin-section-title">API Health</h2>
        {loading ? (
          <div className="admin-chart__loading">Loading…</div>
        ) : (
          <ApiHealthTable
            session={session}
            allTime={allTime}
            history={history}
            services={services}
            serviceColor={serviceColor}
          />
        )}
      </div>

      {/* Cache Health */}
      <div className="admin-card">
        <h2 className="admin-section-title">
          Cache Health
          {cacheMetrics && (
            <span style={{ marginLeft: 12, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 400 }}>
              <span style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: cacheMetrics.redis.connected ? '#10B981' : '#EF4444',
              }} />
              <span style={{ color: 'var(--admin-text-muted)' }}>
                Redis {cacheMetrics.redis.connected ? 'connected' : 'disconnected'}
              </span>
              <span style={{ color: 'var(--admin-text-muted)', marginLeft: 8 }}>
                {cacheMetrics.totalKeys} keys in memory
              </span>
            </span>
          )}
        </h2>
        {loading || !cacheMetrics ? (
          <div className="admin-chart__loading">Loading…</div>
        ) : Object.keys(cacheMetrics.namespaces).length === 0 ? (
          <p style={{ color: 'var(--admin-text-muted)', fontSize: 13 }}>
            No cache activity yet — stats accumulate as the app handles requests.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Object.entries(cacheMetrics.namespaces).map(([ns, stat]) => {
              const pct = Math.round(stat.hitRate * 100);
              const barColor = pct >= 80 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#EF4444';
              return (
                <div key={ns}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 13 }}>
                    <span style={{ fontFamily: 'monospace', color: 'var(--admin-text)' }}>{ns}</span>
                    <span style={{ color: 'var(--admin-text-muted)' }}>
                      {pct}% hit rate &nbsp;·&nbsp; {stat.hits}h / {stat.misses}m / {stat.sets}s
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--admin-border)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Date range controls */}
      <div className="admin-card admin-card--controls">
        <Calendar size={16} className="admin-controls__icon" />
        <label className="admin-controls__label">From</label>
        <input
          type="date"
          value={from}
          max={to}
          onChange={(e) => setFrom(e.target.value)}
          className="admin-date-input"
        />
        <span className="admin-controls__sep">→</span>
        <label className="admin-controls__label">To</label>
        <input
          type="date"
          value={to}
          min={from}
          max={isoToday()}
          onChange={(e) => setTo(e.target.value)}
          className="admin-date-input"
        />
      </div>

      {/* API filter */}
      {services.length > 0 && (
        <div className="admin-card admin-card--controls">
          <Filter size={15} className="admin-controls__icon" />
          <span className="admin-filter__label">APIs</span>
          <div className="admin-filter">
            <button
              className={`admin-filter__pill ${allSelected ? 'admin-filter__pill--active' : ''}`}
              onClick={toggleAll}
            >
              All
            </button>
            {services.map((svc, i) => (
              <button
                key={svc}
                className={`admin-filter__pill ${selected.has(svc) ? 'admin-filter__pill--active' : ''}`}
                onClick={() => toggleService(svc)}
              >
                <span
                  className="admin-filter__dot"
                  style={{ background: serviceColor(svc, i) }}
                />
                {svc}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="admin-stats">
        <div className="admin-stat">
          <div className="admin-stat__value">{totalCalls.toLocaleString()}</div>
          <div className="admin-stat__label">Total calls ({from} – {to})</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat__value">{history.length}</div>
          <div className="admin-stat__label">Days tracked</div>
        </div>
        <div className="admin-stat">
          <div className="admin-stat__value">{filteredServices.length}</div>
          <div className="admin-stat__label">
            {filteredServices.length === services.length
              ? 'Active services'
              : `${filteredServices.length} of ${services.length} services`}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="admin-card">
        <h2 className="admin-section-title">Calls over time</h2>
        {loading ? (
          <div className="admin-chart__loading">Loading chart…</div>
        ) : (
          <UsageChart history={history} services={filteredServices} />
        )}
      </div>

      {/* Table */}
      <div className="admin-card">
        <h2 className="admin-section-title">Daily breakdown</h2>
        {loading ? (
          <div className="admin-chart__loading">Loading table…</div>
        ) : (
          <MetricsTable history={history} services={filteredServices} />
        )}
      </div>
    </div>
  );
}
