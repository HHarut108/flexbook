import type { DayMetrics } from '../api/metrics';

interface Props {
  history: DayMetrics[];
  services: string[];
}

export function MetricsTable({ history, services }: Props) {
  if (history.length === 0) {
    return <p className="admin-table__empty">No data for selected range.</p>;
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th className="admin-table__th admin-table__th--date">Date</th>
            {services.map((s) => (
              <th key={s} className="admin-table__th">
                {s}
              </th>
            ))}
            <th className="admin-table__th admin-table__th--total">Total</th>
          </tr>
        </thead>
        <tbody>
          {history.map((day) => {
            const total = services.reduce((sum, s) => sum + (day.calls[s] ?? 0), 0);
            return (
              <tr key={day.date} className="admin-table__row">
                <td className="admin-table__td admin-table__td--date">{day.date}</td>
                {services.map((s) => {
                  const v = day.calls[s] ?? 0;
                  return (
                    <td key={s} className={`admin-table__td ${v === 0 ? 'admin-table__td--zero' : ''}`}>
                      {v === 0 ? '—' : v.toLocaleString()}
                    </td>
                  );
                })}
                <td className="admin-table__td admin-table__td--total">
                  {total.toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="admin-table__foot-row">
            <td className="admin-table__td admin-table__td--date admin-table__foot-label">Total</td>
            {services.map((s) => {
              const colTotal = history.reduce((sum, d) => sum + (d.calls[s] ?? 0), 0);
              return (
                <td key={s} className="admin-table__td admin-table__foot-cell">
                  {colTotal.toLocaleString()}
                </td>
              );
            })}
            <td className="admin-table__td admin-table__td--total admin-table__foot-cell">
              {history
                .reduce(
                  (sum, d) => sum + services.reduce((s2, sv) => s2 + (d.calls[sv] ?? 0), 0),
                  0,
                )
                .toLocaleString()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
