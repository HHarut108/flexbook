import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import { type Tool } from './ToolCard';
import { useAuthStore } from '../store/auth.store';

interface Props {
  tools: Tool[];
}

interface AccentMap {
  bg: string;
  text: string;
  border: string;
}

const ACCENTS: Record<string, AccentMap> = {
  'quick-search':   { bg: 'bg-sky-soft',     text: 'text-sky',     border: 'border-sky/30' },
  'trip-builder':   { bg: 'bg-orange-soft',  text: 'text-orange',  border: 'border-orange/30' },
  'hop-planner':    { bg: 'bg-orange-soft',  text: 'text-orange',  border: 'border-orange/30' },
  'when-to-go':     { bg: 'bg-emerald-soft', text: 'text-emerald', border: 'border-emerald/30' },
  'budget-planner': { bg: 'bg-indigo-soft',  text: 'text-indigo',  border: 'border-indigo-border' },
};

const QUESTIONS: Record<string, string> = {
  'quick-search':   "I know exactly where and when I want to fly.",
  'trip-builder':   "I have a city — show me where's cheap to fly.",
  'hop-planner':    "I have a city — show me where's cheap to fly.",
  'when-to-go':     "I know where or when — find the cheapest dates.",
  'budget-planner': "I have $X and some days — build me a trip.",
};

/**
 * "HOW DO YOU WANT TO START?" hub card. Renders each tool as a tappable row
 * with a colored icon tile, a leading prompt, and a sub-prompt. Auth-gated
 * tools open a tiny inline prompt — same pattern as ToolsScreen.
 */
export function HomeHubCard({ tools }: Props) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [authPromptTool, setAuthPromptTool] = useState<Tool | null>(null);

  function handleOpen(tool: Tool) {
    if (tool.requiresAuth && !user) {
      setAuthPromptTool(tool);
      return;
    }
    navigate(tool.path);
  }

  return (
    <>
      <div
        className="bg-surface rounded-[24px] md:rounded-[28px] border border-border/60 p-4 md:p-7"
        style={{ boxShadow: '0 24px 60px -20px rgba(15,23,42,0.18)' }}
      >
        <p className="text-[10px] md:text-xs font-extrabold tracking-[0.14em] text-orange uppercase mb-3 md:mb-5">
          How do you want to start?
        </p>

        <div className="flex flex-col gap-2 md:gap-3">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const accent = ACCENTS[tool.id] ?? ACCENTS['quick-search'];
            const question = QUESTIONS[tool.id] ?? tool.tagline;
            const needsAuth = tool.requiresAuth && !user;

            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => handleOpen(tool)}
                className={`group flex items-center gap-3 md:gap-4 w-full text-left px-3 md:px-4 py-2.5 md:py-3.5 rounded-2xl border ${accent.border} bg-surface hover:bg-surface-2/60 transition-all`}
              >
                <div
                  className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl ${accent.bg} flex items-center justify-center shrink-0`}
                >
                  <Icon size={18} className={accent.text} strokeWidth={2.2} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm md:text-[15px] font-bold text-text-primary leading-tight">
                      {tool.name}
                    </h3>
                    {needsAuth && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-soft border border-indigo-border text-[10px] font-bold text-indigo">
                        <Lock size={9} /> Sign in
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] md:text-[13px] text-text-muted leading-snug mt-0.5 line-clamp-2">
                    {question}
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
      </div>

      {authPromptTool && (
        <AuthInlinePrompt
          tool={authPromptTool}
          onClose={() => setAuthPromptTool(null)}
        />
      )}
    </>
  );
}

function AuthInlinePrompt({ tool, onClose }: { tool: Tool; onClose: () => void }) {
  const navigate = useNavigate();
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center px-4"
      onClick={onClose}
      role="dialog"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-3xl max-w-sm w-full p-6 text-center"
        onClick={(e) => e.stopPropagation()}
        style={{ boxShadow: '0 24px 64px rgba(15,23,42,0.2)' }}
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-soft border border-indigo-border flex items-center justify-center mb-4">
          <Lock size={22} className="text-indigo" />
        </div>
        <h3 className="text-lg font-bold text-text-primary mb-2">
          Sign in to use {tool.name}
        </h3>
        <p className="text-sm text-text-muted mb-5">
          {tool.name} is free for Flexbook members. Log in or create a free account to start planning.
        </p>
        <button
          type="button"
          onClick={() => navigate(`/login?from=${encodeURIComponent(tool.path)}`)}
          className="w-full py-3 rounded-2xl bg-indigo text-white text-sm font-bold hover:bg-indigo/90 transition-all mb-2.5"
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => navigate('/signup')}
          className="w-full py-3 rounded-2xl border border-border text-sm font-semibold text-text-primary hover:bg-surface-2 transition-all"
        >
          Create a free account
        </button>
      </div>
    </div>
  );
}
