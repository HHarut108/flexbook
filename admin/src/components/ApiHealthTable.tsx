import { AlertTriangle } from 'lucide-react';
import type { SessionMetricsResponse, AllTimeMetricsResponse, DayMetrics } from '../api/metrics';

interface Props {
  session: SessionMetricsResponse | null;
  allTime: AllTimeMetricsResponse | null;
  history: DayMetrics[];        // full date-range history for today + 7-day sums
  services: string[];           // canonical service list (from history)
  serviceColor: (name: string, index: number) => string;
}

function sumCalls(history: DayMetrics[], service: string, days: number): number {
  return history
    .slice(-days)
    .reduce((sum, d) => sum + (d.calls[service] ?? 0), 0);
}

function todayCalls(history: DayMetrics[], service: string): number {
  if (history.length === 0) return 0;
  const last = history[history.length - 1];
  const today = new Date().toISOString().slice(0, 10);
  return last.date === today ? (last.calls[service] ?? 0) : 0;
}

function allServicesUnion(
  session: SessionMetricsResponse | null,
  allTime: AllTimeMetricsResponse | null,
  historyServices: string[],
): string[] {
  const set = new Set(historyServices);
  if (session) Object.keys(session.calls).forEach((s) => set.add(s));
  if (allTime) Object.keys(allTime.calls).forEach((s) => set.add(s));
  return Array.from(set).sort();
}

function allTimeMax(allTime: AllTimeMetricsResponse | null): number {
  if (!allTime) return 1;
  return Math.max(
    1,
    ...Object.values(allTime.calls).map((b) => b.primary + b.fallback),
  );
}

export function ApiHealthTable({ session, allTime, history, services, serviceColor }: Props) {
  const allSvcs = allServicesUnion(session, allTime, services);
  const maxTotal = allTimeMax(allTime);

  if (allSvcs.length === 0) {
    return <p className="admin-chart__loading">No API calls recorded yet.</p>;
  }

  return (
    <div className="ht-wrapper">
      <table className="ht-table">
        <thead>
          <tr>
            <th className="ht-th ht-th--service">Service</th>
            <th className="ht-th ht-th--num" colSpan={2}>
              This Session
              {session && (
                <span className="ht-th__sub">
                  since {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </th>
            <th className="ht-th ht-th--num">Today</th>
            <th className="ht-th ht-th--num">7d</th>
            <th className="ht-th ht-th--num" colSpan={2}>All Time</th>
            <th className="ht-th ht-th--bar" />
          </tr>
          <tr className="ht-subhead">
            <th />
            <th className="ht-th ht-th--sub">Primary</th>
            <th className="ht-th ht-th--sub">Fallback</th>
            <th />
            <th />
            <th className="ht-th ht-th--sub">Primary</th>
            <th className="ht-th ht-th--sub">Fallback</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {allSvcs.map((svc, i) => {
            const sessionBd = session?.calls[svc];
            const allTimeBd = allTime?.calls[svc];
            const today = todayCalls(history, svc);
            const sevenDay = sumCalls(history, svc, 7);
            const allTotal = allTimeBd ? allTimeBd.primary + allTimeBd.fallback : 0;
            const hasFallback =
              (sessionBd?.fallback ?? 0) > 0 || (allTimeBd?.fallback ?? 0) > 0;
            const barPct = allTotal > 0 ? Math.round((allTotal / maxTotal) * 100) : 0;

            return (
              <tr key={svc} className={`ht-row${hasFallback ? ' ht-row--warn' : ''}`}>
                <td className="ht-td ht-td--service">
                  <span
                    className="ht-dot"
                    style={{ background: serviceColor(svc, i) }}
                  />
                  <span className="ht-svc-name">{svc}</span>
                  {hasFallback && (
                    <AlertTriangle size={12} className="ht-warn-icon" />
                  )}
                </td>
                <td className="ht-td ht-td--num">
                  {sessionBd && sessionBd.primary > 0
                    ? sessionBd.primary.toLocaleString()
                    : <span className="ht-cell--zero">—</span>}
                </td>
                <td className="ht-td ht-td--num">
                  {sessionBd && sessionBd.fallback > 0
                    ? <span className="ht-fallback-val">{sessionBd.fallback.toLocaleString()}</span>
                    : <span className="ht-cell--zero">—</span>}
                </td>
                <td className="ht-td ht-td--num">
                  {today > 0 ? today.toLocaleString() : <span className="ht-cell--zero">—</span>}
                </td>
                <td className="ht-td ht-td--num">
                  {sevenDay > 0 ? sevenDay.toLocaleString() : <span className="ht-cell--zero">—</span>}
                </td>
                <td className="ht-td ht-td--num">
                  {allTimeBd && allTimeBd.primary > 0
                    ? allTimeBd.primary.toLocaleString()
                    : <span className="ht-cell--zero">—</span>}
                </td>
                <td className="ht-td ht-td--num">
                  {allTimeBd && allTimeBd.fallback > 0
                    ? <span className="ht-fallback-val">{allTimeBd.fallback.toLocaleString()}</span>
                    : <span className="ht-cell--zero">—</span>}
                </td>
                <td className="ht-td ht-td--bar">
                  <div className="ht-bar-track">
                    <div
                      className="ht-bar-fill"
                      style={{
                        width: `${barPct}%`,
                        background: serviceColor(svc, i),
                      }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="ht-legend">
        <span className="ht-legend__item">
          <AlertTriangle size={11} className="ht-warn-icon" />
          Fallback calls detected — primary provider was failing when these fired
        </span>
      </p>
    </div>
  );
}
