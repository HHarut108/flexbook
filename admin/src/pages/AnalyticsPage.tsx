import { useState } from 'react';
import {
  Filter,
  TrendingUp,
  MousePointerClick,
  Megaphone,
  ExternalLink,
  Info,
} from 'lucide-react';

interface AnalyticsTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  /** PostHog shared dashboard/insight embed URL, injected per-env. */
  url?: string;
  /** Env var that supplies the embed URL — shown in the setup hint. */
  envKey: string;
  hint: string;
}

const env = import.meta.env;

const TABS: AnalyticsTab[] = [
  {
    id: 'funnel',
    label: 'Conversion funnel',
    icon: <Filter size={14} />,
    url: env.VITE_POSTHOG_EMBED_FUNNEL,
    envKey: 'VITE_POSTHOG_EMBED_FUNNEL',
    hint: 'A PostHog funnel insight over trip_search_started → booking_clicked → trip_shared.',
  },
  {
    id: 'traffic',
    label: 'Traffic over time',
    icon: <TrendingUp size={14} />,
    url: env.VITE_POSTHOG_EMBED_TRAFFIC,
    envKey: 'VITE_POSTHOG_EMBED_TRAFFIC',
    hint: 'A trends insight for pageviews, unique visitors and sessions per day.',
  },
  {
    id: 'events',
    label: 'Top events / taps',
    icon: <MousePointerClick size={14} />,
    url: env.VITE_POSTHOG_EMBED_EVENTS,
    envKey: 'VITE_POSTHOG_EMBED_EVENTS',
    hint: 'A breakdown of the most-fired autocapture taps and top pages.',
  },
  {
    id: 'acquisition',
    label: 'Acquisition / ad source',
    icon: <Megaphone size={14} />,
    url: env.VITE_POSTHOG_EMBED_ACQUISITION,
    envKey: 'VITE_POSTHOG_EMBED_ACQUISITION',
    hint: 'A breakdown by UTM source / medium / campaign and referring domain.',
  },
];

const PROJECT_URL = (env.VITE_POSTHOG_PROJECT_URL ?? 'https://us.posthog.com').replace(/\/+$/, '');

export function AnalyticsPage() {
  const [activeId, setActiveId] = useState(TABS[0].id);
  const tab = TABS.find((t) => t.id === activeId) ?? TABS[0];

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <h1 className="admin-page__title">Analytics</h1>
          <p className="admin-page__subtitle">
            Guest funnel, traffic and acquisition — powered by PostHog
          </p>
        </div>
        <a
          className="admin-btn admin-btn--ghost"
          href={PROJECT_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open in PostHog <ExternalLink size={15} />
        </a>
      </div>

      <div className="admin-filter" role="tablist" aria-label="Analytics views">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === activeId}
            className={`admin-filter__pill ${t.id === activeId ? 'admin-filter__pill--active' : ''}`}
            onClick={() => setActiveId(t.id)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab.url ? (
        <div className="analytics-embed">
          <iframe
            key={tab.id}
            title={tab.label}
            src={tab.url}
            className="analytics-embed__frame"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="admin-card analytics-setup">
          <Info size={20} className="analytics-setup__icon" />
          <div className="analytics-setup__body">
            <p className="analytics-setup__title">"{tab.label}" isn't connected yet</p>
            <p className="analytics-setup__text">{tab.hint}</p>
            <ol className="analytics-setup__steps">
              <li>In PostHog, open the insight or dashboard you want to embed.</li>
              <li>
                Click <strong>Share</strong> → enable sharing → copy the <strong>embed</strong> URL
                (looks like <code>{PROJECT_URL}/embedded/&lt;token&gt;</code>).
              </li>
              <li>
                Set it as <code>{tab.envKey}</code> in the admin project's environment (Vercel),
                then redeploy.
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
