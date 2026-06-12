import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { type Tool } from './ToolCard';
import { track, AnalyticsEvent } from '../lib/analytics';

interface Props {
  tools: Tool[];
}

interface AccentMap {
  bg: string;
  text: string;
  border: string;
}

/**
 * Per-option visuals — keyed by the router pick (`route` / `dates` / `budget`
 * / `open`), not by tool id, so this map stays stable even if we re-point a
 * pick to a different tool downstream.
 */
const ACCENTS: Record<RouterPickId, AccentMap> = {
  route:  { bg: 'bg-sky-soft',     text: 'text-sky',     border: 'border-sky/30' },
  dates:  { bg: 'bg-emerald-soft', text: 'text-emerald', border: 'border-emerald/30' },
  budget: { bg: 'bg-indigo-soft',  text: 'text-indigo',  border: 'border-indigo-border' },
  open:   { bg: 'bg-orange-soft',  text: 'text-orange',  border: 'border-orange/30' },
};

type RouterPickId = 'route' | 'dates' | 'budget' | 'open';

interface RouterOption {
  id: RouterPickId;
  /** Tool id from `TOOLS` (in ToolsScreen.tsx) this pick resolves to. */
  toolId: string;
  headline: string;
  sub: string;
}

/**
 * The pick → tool mapping is the whole point of this component. Every option
 * names a piece of context the visitor already has, and routes them to the
 * tool that turns *that* piece of context into a trip.
 *
 *   "I know my route" → Find a Flight (quick-search)
 *   "I know my window" → When to Go (when-to-go)
 *   "I know my budget" → Plan by Budget (budget-planner)
 *   "I know nothing yet" → Trip Builder (trip-builder, the flagship)
 *
 * Tool icons are pulled from the catalog so the visual continues to line up
 * with whatever the tool page itself displays.
 */
const ROUTER_OPTIONS: RouterOption[] = [
  {
    id: 'route',
    toolId: 'quick-search',
    headline: 'A specific route',
    sub: 'I know where and when I want to fly.',
  },
  {
    id: 'dates',
    toolId: 'when-to-go',
    headline: 'A flexible window',
    sub: 'I know the route — dates are open.',
  },
  {
    id: 'budget',
    toolId: 'budget-planner',
    headline: 'A budget',
    sub: 'I have $X and some days — build me a trip.',
  },
  {
    id: 'open',
    toolId: 'trip-builder',
    headline: 'An open mind',
    sub: 'Just an airport. Surprise me with the cheapest first hop.',
  },
];

/**
 * "What are you starting with?" router card. Replaces the 4-tool hub on the
 * V2 home with a one-question chooser so the visitor doesn't have to evaluate
 * four tools to pick the right entry point — they pick the context they
 * already have, we pick the tool.
 *
 * Every pick is tracked with `AnalyticsEvent.HomeRouterPick` so the
 * conversion rate of each option can be measured against the prior 4-card
 * hub. Reverting to `HomeHubCard` (still in the codebase) is a one-line swap
 * in `HomeScreenV2.tsx`.
 */
export function HomeRouterCard({ tools }: Props) {
  const navigate = useNavigate();

  const toolsById = new Map(tools.map((t) => [t.id, t]));

  function handlePick(option: RouterOption) {
    const tool = toolsById.get(option.toolId);
    if (!tool) {
      // Catalog drift — pick maps to an id that's no longer in TOOLS. Fall
      // back to the home page rather than crash; the analytics event still
      // fires so the drift is observable.
      track(AnalyticsEvent.HomeRouterPick, { pick: option.id, tool: option.toolId, drift: true });
      navigate('/');
      return;
    }
    track(AnalyticsEvent.HomeRouterPick, { pick: option.id, tool: tool.id });
    navigate(tool.path);
  }

  return (
    <div
      className="bg-surface rounded-[24px] md:rounded-[28px] border border-border/60 p-4 md:p-7"
      style={{ boxShadow: '0 24px 60px -20px rgba(15,23,42,0.18)' }}
    >
      <p className="text-[10px] md:text-xs font-extrabold tracking-[0.14em] text-orange uppercase mb-3 md:mb-5">
        What are you starting with?
      </p>

      <div className="flex flex-col gap-2 md:gap-3">
        {ROUTER_OPTIONS.map((option) => {
          const tool = toolsById.get(option.toolId);
          const Icon = tool?.icon;
          const accent = ACCENTS[option.id];

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handlePick(option)}
              className={`group flex items-center gap-3 md:gap-4 w-full text-left px-3 md:px-4 py-2.5 md:py-3.5 rounded-2xl border ${accent.border} bg-surface hover:bg-surface-2/60 transition-all`}
            >
              <div
                className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl ${accent.bg} flex items-center justify-center shrink-0`}
              >
                {Icon ? (
                  <Icon size={18} className={accent.text} strokeWidth={2.2} />
                ) : null}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm md:text-[15px] font-bold text-text-primary leading-tight">
                  {option.headline}
                </h3>
                <p className="text-[11px] md:text-[13px] text-text-muted leading-snug mt-0.5 line-clamp-2">
                  {option.sub}
                </p>
              </div>
              <ArrowRight
                size={16}
                className={`shrink-0 ${accent.text} transition-transform group-hover:translate-x-0.5`}
              />
            </button>
          );
        })}
      </div>

      {/* Soft footer: reinforces the no-account promise so the anchor's
          third phrase ("No account.") lands once more right next to the
          primary CTA list. */}
      <p className="text-[11px] md:text-xs text-text-muted/80 mt-3 md:mt-5 text-center">
        Every option is free. No account needed.
      </p>
    </div>
  );
}
