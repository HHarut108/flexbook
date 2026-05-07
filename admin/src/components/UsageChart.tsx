import { useMemo } from 'react';
import type { DayMetrics } from '../api/metrics';

const SERVICE_COLORS: Record<string, string> = {
  kiwi: '#4F46E5',
  'rapidapi-kiwi': '#8B5CF6',
  serpapi: '#F97316',
  openweathermap: '#0EA5E9',
  'google-places': '#10B981',
  airhex: '#F59E0B',
};

const FALLBACK_COLORS = ['#EC4899', '#14B8A6', '#64748B', '#EF4444'];

const CHART_H = 220;
const CHART_W = 900;
const PAD = { top: 16, right: 24, bottom: 40, left: 52 };

function getColor(service: string, index: number): string {
  return SERVICE_COLORS[service] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

interface Props {
  history: DayMetrics[];
  services: string[];
}

export function UsageChart({ history, services }: Props) {
  const { points, yMax, xLabels } = useMemo(() => {
    if (history.length === 0) return { points: {}, yMax: 1, xLabels: [] };

    let yMax = 1;
    const xLabels = history.map((d) => d.date.slice(5)); // MM-DD

    const points: Record<string, [number, number][]> = {};
    for (const service of services) {
      points[service] = history.map((day, i) => {
        const v = day.calls[service] ?? 0;
        if (v > yMax) yMax = v;
        return [i, v];
      });
    }

    return { points, yMax, xLabels };
  }, [history, services]);

  const plotW = CHART_W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;
  const n = history.length;

  function toX(i: number) {
    if (n <= 1) return PAD.left + plotW / 2;
    return PAD.left + (i / (n - 1)) * plotW;
  }

  function toY(v: number) {
    return PAD.top + plotH - (v / yMax) * plotH;
  }

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * yMax));

  if (history.length === 0) {
    return (
      <div className="admin-chart__empty">No data for selected range</div>
    );
  }

  return (
    <div className="admin-chart">
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="admin-chart__svg"
        aria-label="API call history chart"
      >
        {/* Grid lines + Y labels */}
        {yTicks.map((tick) => {
          const y = toY(tick);
          return (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={CHART_W - PAD.right}
                y1={y}
                y2={y}
                stroke="#374151"
                strokeWidth={1}
                strokeDasharray={tick === 0 ? undefined : '4 4'}
              />
              <text
                x={PAD.left - 8}
                y={y + 4}
                textAnchor="end"
                fill="#9CA3AF"
                fontSize={11}
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* X labels — show every Nth date to avoid overlap */}
        {xLabels.map((label, i) => {
          const step = Math.max(1, Math.ceil(n / 10));
          if (i % step !== 0 && i !== n - 1) return null;
          return (
            <text
              key={i}
              x={toX(i)}
              y={CHART_H - PAD.bottom + 16}
              textAnchor="middle"
              fill="#9CA3AF"
              fontSize={10}
            >
              {label}
            </text>
          );
        })}

        {/* Lines */}
        {services.map((service, si) => {
          const pts = points[service];
          if (!pts) return null;
          const d = pts
            .map(([i, v], idx) => `${idx === 0 ? 'M' : 'L'} ${toX(i)} ${toY(v)}`)
            .join(' ');
          return (
            <path
              key={service}
              d={d}
              fill="none"
              stroke={getColor(service, si)}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}

        {/* Dots on last point per service */}
        {services.map((service, si) => {
          const pts = points[service];
          if (!pts || pts.length === 0) return null;
          const [i, v] = pts[pts.length - 1];
          return (
            <circle
              key={service}
              cx={toX(i)}
              cy={toY(v)}
              r={3}
              fill={getColor(service, si)}
            />
          );
        })}
      </svg>

      {/* Legend */}
      <div className="admin-chart__legend">
        {services.map((service, si) => (
          <div key={service} className="admin-chart__legend-item">
            <span
              className="admin-chart__legend-dot"
              style={{ background: getColor(service, si) }}
            />
            <span className="admin-chart__legend-label">{service}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
