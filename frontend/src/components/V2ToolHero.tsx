import type { ReactNode } from 'react';

interface Props {
  /** Appears after "FLEXBOOK TOOL · " in the orange tracked badge (rendered
   *  as "Flexbook tool · {toolName}" with the canonical brand casing). */
  toolName: string;
  /** First line of the headline, rendered in default text colour. */
  titleLine1: string;
  /** Second line: a single word rendered in indigo with an orange dot accent. */
  titleAccent: string;
  /** Subhead — short marketing copy under the title. */
  subhead: string;
  /** Right-rail content (e.g. extra trust badges). */
  rightSlot?: ReactNode;
}

/**
 * Tool-page hero in the V1 style: short orange dash + uppercase tracked badge,
 * a two-line headline where the accent word is indigo with an orange dot, and
 * a tight subhead. Reused across every V2 tool page so the chrome feels like
 * one product.
 *
 * Mirrors the layout in HopPlannerScreen.tsx:248-286.
 */
export function V2ToolHero({
  toolName,
  titleLine1,
  titleAccent,
  subhead,
  rightSlot,
}: Props) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5 md:mb-6 flex-wrap">
      <div className="flex-1 min-w-0">
        {/* Dash + badge */}
        <div className="flex items-center gap-2 mb-3">
          <div className="h-0.5 w-5 bg-orange rounded-full" />
          <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.14em] text-orange">
            Flexbook tool · {toolName}
          </p>
        </div>

        {/* Title — line 1 dark, line 2 indigo with orange dot. Clamp is sized
            so the title fits in 2 lines inside the lg left column rather than
            wrapping to 3. */}
        <h1
          className="leading-[0.95] font-black text-text-primary"
          style={{
            fontSize: 'clamp(2rem, 3.4vw, 4rem)',
            letterSpacing: '-0.045em',
          }}
        >
          {titleLine1}
          <br />
          <span className="relative inline-block">
            <span className="text-indigo">{titleAccent}</span>
            <span
              className="absolute -right-[0.4em] -top-[0.15em] font-black text-orange select-none"
              style={{ fontSize: '1.6em', lineHeight: 1 }}
              aria-hidden
            >
              .
            </span>
          </span>
        </h1>

        {/* Subhead */}
        <p className="mt-3 md:mt-4 text-sm md:text-base lg:text-lg leading-6 md:leading-7 text-text-muted max-w-[40ch]">
          {subhead}
        </p>
      </div>

      {rightSlot && <div className="hidden md:block">{rightSlot}</div>}
    </div>
  );
}
