import { Link } from 'react-router-dom';
import { ArrowRight, Check, Lock, type LucideIcon } from 'lucide-react';

export interface Tool {
  id: string;
  name: string;
  tagline: string;
  description: string;
  features: string[];
  path: string;
  requiresAuth: boolean;
  icon: LucideIcon;
  gradient: string;
}

interface FullProps {
  tool: Tool;
  variant?: 'full';
  onOpen: (tool: Tool) => void;
}

interface CompactProps {
  tool: Tool;
  variant: 'compact';
}

type Props = FullProps | CompactProps;

export function ToolCard(props: Props) {
  const { tool } = props;
  const Icon = tool.icon;

  if (props.variant === 'compact') {
    return (
      <Link
        to={tool.path}
        className="section-shell p-5 flex flex-col gap-3 transition-colors hover:border-indigo-border group"
      >
        <div className="flex items-start gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: tool.gradient, boxShadow: '0 8px 24px rgba(15,23,42,0.10)' }}
          >
            <Icon size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h3 className="text-base font-bold text-text-primary leading-tight">{tool.name}</h3>
              {tool.requiresAuth && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-soft border border-indigo-border text-[10px] font-bold text-indigo">
                  <Lock size={9} /> Sign in
                </span>
              )}
            </div>
            <p className="text-[11px] font-semibold text-indigo-mid">{tool.tagline}</p>
          </div>
        </div>
        <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
          {tool.description}
        </p>
        <div className="flex items-center gap-1 text-xs font-bold text-indigo mt-auto group-hover:gap-2 transition-all">
          Open {tool.name}
          <ArrowRight size={13} />
        </div>
      </Link>
    );
  }

  const { onOpen } = props;
  return (
    <div className="section-shell p-6 transition-colors hover:border-indigo-border">
      <div className="flex items-start gap-4 mb-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{ background: tool.gradient, boxShadow: '0 8px 24px rgba(15,23,42,0.10)' }}
        >
          <Icon size={22} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-lg font-bold text-text-primary leading-tight">{tool.name}</h2>
            {tool.requiresAuth && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-soft border border-indigo-border text-[11px] font-bold text-indigo">
                <Lock size={10} /> Sign in
              </span>
            )}
          </div>
          <p className="text-xs font-semibold text-indigo-mid">{tool.tagline}</p>
        </div>
      </div>

      <p className="text-sm text-text-secondary leading-relaxed mb-4">{tool.description}</p>

      <ul className="space-y-2 mb-5">
        {tool.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-xs text-text-secondary">
            <span className="mt-0.5 w-4 h-4 rounded-full bg-emerald/10 flex items-center justify-center shrink-0">
              <Check size={10} className="text-emerald" strokeWidth={3} />
            </span>
            <span className="leading-relaxed">{f}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onOpen(tool)}
        className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-indigo text-white text-sm font-bold hover:bg-indigo/90 transition-all active:scale-[0.98]"
        style={{ boxShadow: '0 10px 28px rgba(55,48,163,0.28)' }}
      >
        Open {tool.name}
        <ArrowRight size={15} />
      </button>
    </div>
  );
}
