import { Resend } from 'resend';
import { config } from '../config';
import { getMetrics, getMetricsHistory, getAllTimeMetrics } from '../utils/apiMetrics';

const SERVICE_LABELS: Record<string, string> = {
  'kiwi': 'Kiwi (Direct)',
  'rapidapi-kiwi': 'RapidAPI Kiwi',
  'serpapi': 'SerpAPI (Google Flights)',
  'openweathermap': 'OpenWeatherMap',
  'google-places': 'Google Places',
};

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function buildTable(calls: Record<string, number>): string {
  const rows = Object.entries(calls)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;">${SERVICE_LABELS[key] ?? key}</td>
        <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;">${count}</td>
      </tr>`)
    .join('');

  const total = Object.values(calls).reduce((s, n) => s + n, 0);

  return `
    <table style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:14px;">
      <thead>
        <tr style="background:#f7f7f7;">
          <th style="padding:10px 16px;text-align:left;font-weight:600;color:#555;">Service</th>
          <th style="padding:10px 16px;text-align:right;font-weight:600;color:#555;">Calls</th>
        </tr>
      </thead>
      <tbody>
        ${rows.length ? rows : '<tr><td colspan="2" style="padding:10px 16px;color:#999;">No calls recorded</td></tr>'}
      </tbody>
      <tfoot>
        <tr style="background:#f7f7f7;">
          <td style="padding:10px 16px;font-weight:700;">Total</td>
          <td style="padding:10px 16px;text-align:right;font-weight:700;">${total}</td>
        </tr>
      </tfoot>
    </table>`;
}

function buildHtml(title: string, subtitle: string, body: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;padding:0;background:#f4f4f4;font-family:sans-serif;">
      <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.07);">
        <div style="background:#1a1a2e;padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:20px;">FlexBook</h1>
          <p style="margin:4px 0 0;color:#aaa;font-size:13px;">API Usage Report</p>
        </div>
        <div style="padding:28px 32px;">
          <h2 style="margin:0 0 4px;font-size:18px;color:#1a1a2e;">${title}</h2>
          <p style="margin:0 0 24px;color:#888;font-size:13px;">${subtitle}</p>
          ${body}
        </div>
        <div style="padding:16px 32px;background:#f7f7f7;border-top:1px solid #eee;">
          <p style="margin:0;font-size:12px;color:#aaa;">FlexBook backend · Upstash Redis · auto-generated</p>
        </div>
      </div>
    </body>
    </html>`;
}

export async function sendDailyReport(date?: string): Promise<{ sent: boolean; error?: string }> {
  if (!config.RESEND_API_KEY) return { sent: false, error: 'RESEND_API_KEY not configured' };

  const d = date ?? new Date().toISOString().slice(0, 10);
  const [{ calls }, alltimeBreakdown] = await Promise.all([getMetrics(d), getAllTimeMetrics()]);
  const total = Object.values(calls).reduce((s, n) => s + n, 0);
  const alltimeTotals: Record<string, number> = {};
  for (const [svc, b] of Object.entries(alltimeBreakdown)) alltimeTotals[svc] = b.primary + b.fallback;
  const alltimeTotal = Object.values(alltimeTotals).reduce((s, n) => s + n, 0);

  const resend = new Resend(config.RESEND_API_KEY);

  const body = `
    <h3 style="margin:0 0 12px;font-size:15px;color:#1a1a2e;">Today — ${formatDate(d)}</h3>
    ${buildTable(calls)}
    <h3 style="margin:24px 0 12px;font-size:15px;color:#1a1a2e;">All-Time Total</h3>
    ${buildTable(alltimeTotals)}
  `;

  const html = buildHtml(
    `Daily API Report — ${d}`,
    `${total} call${total !== 1 ? 's' : ''} today · ${alltimeTotal.toLocaleString()} all-time`,
    body,
  );

  const { error } = await resend.emails.send({
    from: 'FlexBook <onboarding@resend.dev>',
    to: 'harutproduct@gmail.com',
    subject: `FlexBook API Report — ${d}`,
    html,
  });

  if (error) return { sent: false, error: error.message };
  return { sent: true };
}

export async function sendHistoryReport(from: string, to: string): Promise<{ sent: boolean; error?: string }> {
  if (!config.RESEND_API_KEY) return { sent: false, error: 'RESEND_API_KEY not configured' };

  const history = await getMetricsHistory(from, to);

  const historyRows = history
    .filter((d) => Object.keys(d.calls).length > 0)
    .map((d) => {
      const total = Object.values(d.calls).reduce((s, n) => s + n, 0);
      const breakdown = Object.entries(d.calls)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${SERVICE_LABELS[k] ?? k}: ${v}`)
        .join(', ');
      return `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;">${d.date}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600;">${total}</td>
          <td style="padding:10px 16px;border-bottom:1px solid #f0f0f0;color:#888;font-size:12px;">${breakdown}</td>
        </tr>`;
    })
    .join('');

  const grandTotal = history.reduce((s, d) => s + Object.values(d.calls).reduce((a, n) => a + n, 0), 0);

  const table = `
    <table style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:14px;">
      <thead>
        <tr style="background:#f7f7f7;">
          <th style="padding:10px 16px;text-align:left;font-weight:600;color:#555;">Date</th>
          <th style="padding:10px 16px;text-align:right;font-weight:600;color:#555;">Total</th>
          <th style="padding:10px 16px;text-align:left;font-weight:600;color:#555;">Breakdown</th>
        </tr>
      </thead>
      <tbody>
        ${historyRows || '<tr><td colspan="3" style="padding:10px 16px;color:#999;">No data for this period</td></tr>'}
      </tbody>
      <tfoot>
        <tr style="background:#f7f7f7;">
          <td style="padding:10px 16px;font-weight:700;">Grand Total</td>
          <td style="padding:10px 16px;text-align:right;font-weight:700;">${grandTotal}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>`;

  const resend = new Resend(config.RESEND_API_KEY);

  const html = buildHtml(
    `History Report — ${from} to ${to}`,
    `${grandTotal} total API calls over ${history.length} day${history.length !== 1 ? 's' : ''}`,
    table,
  );

  const { error } = await resend.emails.send({
    from: 'FlexBook <onboarding@resend.dev>',
    to: 'harutproduct@gmail.com',
    subject: `FlexBook API History — ${from} to ${to}`,
    html,
  });

  if (error) return { sent: false, error: error.message };
  return { sent: true };
}
