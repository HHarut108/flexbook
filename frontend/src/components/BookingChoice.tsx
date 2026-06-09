import { ArrowRight, Headphones, ListChecks, Sparkles } from 'lucide-react';

/** Dual-route CTA shown to multi-city travelers on the trip review screens.
 *
 *  Card 1 — "Book it myself": walks the user through a step-by-step booking
 *  checklist (the Booking Concierge). Free, immediate, no contact required.
 *
 *  Card 2 — "Have us book it": submits an assistance request that lands in the
 *  back-office inbox. Our team books the tickets on the user's behalf.
 *
 *  Round-trip and one-way trips don't use this — Kiwi sells those as a single
 *  ticket, so there's no checklist to manage. The choice screen is multi-city-
 *  only by design.
 */
interface Props {
  /** Trip currency-formatted total, e.g. "$447". Shown in the assist card to
   *  make the offer tangible. Pass empty string to hide. */
  totalLabel?: string;
  /** Number of separate tickets the user will be booking. Drives the DIY card's
   *  time estimate and the per-card explainer copy. */
  legCount: number;
  onSelfService: () => void;
  onRequestAssistance: () => void;
}

export function BookingChoice({
  totalLabel,
  legCount,
  onSelfService,
  onRequestAssistance,
}: Props) {
  // Soft estimate. Real Kiwi checkouts are typically 2-5 min/ticket; we lean to
  // the upper bound so users aren't surprised mid-flow.
  const estimateMinutes = Math.max(5, legCount * 3);

  return (
    <div className="space-y-3">
      <div className="px-1">
        <p className="text-[11px] uppercase tracking-[0.16em] text-text-muted font-semibold mb-1">
          How would you like to book?
        </p>
        <p className="text-[11px] text-text-muted leading-relaxed">
          This trip is {legCount} separate ticket{legCount === 1 ? '' : 's'} — one per leg.
          Pick the path that suits you.
        </p>
      </div>

      {/* ── Card 1 — DIY (primary) ─────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onSelfService}
        className="group w-full text-left rounded-2xl bg-orange text-white px-4 py-4 hover:bg-orange-dark transition-all active:scale-[0.99]"
        style={{ boxShadow: '0 14px 30px -10px rgba(249,115,22,0.45)' }}
        aria-label="Book each ticket yourself with our step-by-step checklist"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
            <ListChecks size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-bold text-base text-white">Book it myself</p>
              <span className="text-[10px] uppercase tracking-[0.14em] font-mono bg-white/20 px-1.5 py-0.5 rounded-full">
                Free
              </span>
            </div>
            <p className="text-[12px] text-white/90 leading-relaxed">
              We'll walk you through each ticket in order. About {estimateMinutes} minutes
              total. Resume anytime — your progress is saved.
            </p>
          </div>
          <ArrowRight
            size={18}
            className="text-white/80 shrink-0 mt-1 transition-transform group-hover:translate-x-0.5"
          />
        </div>
      </button>

      {/* ── Card 2 — Assistance (secondary) ────────────────────────────────── */}
      <button
        type="button"
        onClick={onRequestAssistance}
        className="group w-full text-left rounded-2xl bg-indigo-soft border border-indigo-border/70 px-4 py-4 hover:border-indigo hover:bg-indigo-soft/80 transition-all active:scale-[0.99]"
        aria-label="Have our team book the entire trip for you"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo flex items-center justify-center shrink-0">
            <Headphones size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <p className="font-bold text-base text-text-primary">Have us book it</p>
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] font-mono bg-indigo/10 text-indigo px-1.5 py-0.5 rounded-full">
                <Sparkles size={9} /> Free during launch
              </span>
            </div>
            <p className="text-[12px] text-text-muted leading-relaxed">
              Share your contact details and our team will book every leg for you{totalLabel ? `, ${totalLabel} total` : ''}.
              No tabs to juggle, no checklist to track.
            </p>
          </div>
          <ArrowRight
            size={18}
            className="text-text-muted shrink-0 mt-1 transition-transform group-hover:translate-x-0.5"
          />
        </div>
      </button>
    </div>
  );
}
