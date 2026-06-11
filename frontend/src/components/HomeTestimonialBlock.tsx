import { Star } from 'lucide-react';

const SAMPLE_ROUTES: { route: string; days: number; price: string }[] = [
  { route: 'BCN → LIS → MAD → BCN', days: 12, price: '$287' },
  { route: 'BER → PRG → BUD → BER', days: 9,  price: '$164' },
  { route: 'BCN → ATH → SKG → SOF', days: 10, price: '$398' },
];

/**
 * "Travelers are chaining cities for less than a tank of gas" block —
 * dark left panel with three sample routes + right testimonial quote.
 */
export function HomeTestimonialBlock() {
  return (
    <section className="max-w-6xl xl:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 mt-20 md:mt-28">
      <div
        className="rounded-[32px] overflow-hidden grid md:grid-cols-2 gap-0"
        style={{
          background: 'linear-gradient(135deg, #1a1f3a 0%, #0f1428 100%)',
          boxShadow: '0 24px 70px -20px rgba(15,23,42,0.45)',
        }}
      >
        {/* Routes panel */}
        <div className="p-8 md:p-10 lg:p-12">
          <p className="text-[11px] font-extrabold tracking-[0.18em] text-orange uppercase mb-4">
            Real routes, real prices
          </p>
          <h2 className="text-2xl md:text-3xl lg:text-[34px] font-black text-white leading-tight tracking-tight mb-8">
            Travelers are chaining cities for less than a tank of gas.
          </h2>

          <div className="space-y-3">
            {SAMPLE_ROUTES.map((r) => (
              <div
                key={r.route}
                className="flex items-center justify-between gap-4 px-4 py-3.5 rounded-2xl bg-white/5 border border-white/10"
              >
                <span className="text-sm md:text-[15px] font-bold text-white tracking-tight">
                  {r.route}
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-white/60">{r.days} days</span>
                  <span className="text-base md:text-lg font-black text-orange">{r.price}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonial panel */}
        <div className="p-8 md:p-10 lg:p-12 flex flex-col justify-center border-t md:border-t-0 md:border-l border-white/10">
          <Star size={28} className="text-orange mb-5" strokeWidth={1.5} />
          <blockquote className="text-lg md:text-xl text-white leading-relaxed font-normal mb-6">
            “I built a 4-city loop for $290 in about two minutes. No sign-up,
            no upsell. I keep coming back.”
          </blockquote>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange flex items-center justify-center text-white font-bold text-sm">
              A
            </div>
            <div>
              <div className="text-sm font-bold text-white">Aram K.</div>
              <div className="text-xs text-white/60">Digital nomad · Lisbon</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
