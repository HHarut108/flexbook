import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Send, AlertCircle, CheckCircle2, Calendar } from 'lucide-react';
import { fetchMetricsHistory, sendReport } from '../api/metrics';
import type { DayMetrics } from '../api/metrics';
import { UsageChart } from '../components/UsageChart';
import { MetricsTable } from '../components/MetricsTable';

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
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [reportStatus, setReportStatus] = useState<ReportStatus>('idle');
  const [reportError, setReportError] = useState('');

  const load = useCallback(async () => {
    if (from > to) return;
    setLoading(true);
    setFetchError('');
    try {
      const res = await fetchMetricsHistory(from, to);
      setHistory(res.history);
      setServices(extractServices(res.history));
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load metrics.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

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

  const totalCalls = history.reduce(
    (sum, d) => sum + services.reduce((s2, sv) => s2 + (d.calls[sv] ?? 0), 0),
    0,
  );

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

      {fetchError && (
        <div className="admin-alert admin-alert--error">
          <AlertCircle size={15} />
          {fetchError}
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
          <div className="admin-stat__value">{services.length}</div>
          <div className="admin-stat__label">Active services</div>
        </div>
      </div>

      {/* Chart */}
      <div className="admin-card">
        <h2 className="admin-section-title">Calls over time</h2>
        {loading ? (
          <div className="admin-chart__loading">Loading chart…</div>
        ) : (
          <UsageChart history={history} services={services} />
        )}
      </div>

      {/* Table */}
      <div className="admin-card">
        <h2 className="admin-section-title">Daily breakdown</h2>
        {loading ? (
          <div className="admin-chart__loading">Loading table…</div>
        ) : (
          <MetricsTable history={history} services={services} />
        )}
      </div>
    </div>
  );
}
