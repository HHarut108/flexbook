import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { GoHomeLogo } from './GoHomeLogo';

function sampleTripHref(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  const depart = d.toISOString().slice(0, 10);
  const params = new URLSearchParams({
    type: 'oneway',
    origin: 'BCN',
    destination: 'AMS',
    depart,
    pax: '1',
  });
  return `/search?${params.toString()}`;
}

/**
 * Shared footer for V2 screens. Three columns on desktop, stacks on mobile.
 * Lives below page content; nothing inside it knows about the V2 flag.
 */
export function Footer() {
  return (
    <footer className="relative mt-16 border-t border-border/60 bg-surface-2/40">
      <div className="max-w-6xl xl:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 py-10 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-6">
          {/* Brand + tagline */}
          <div className="md:col-span-1">
            <GoHomeLogo size="lg" variant="light" />
            <p className="mt-4 text-sm text-text-muted leading-6 max-w-[28ch]">
              Travel more. Learn more. Spend less. Flexible by design, cheaper
              by default — no account, no upsell, no markup.
            </p>
          </div>

          {/* Tools column */}
          <div>
            <h4 className="text-sm font-bold text-text-primary mb-4">Tools</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/quick-search" className="text-text-muted hover:text-text-primary transition-colors">
                  Quick Search
                </Link>
              </li>
              <li>
                <Link to="/hop-planner" className="text-text-muted hover:text-text-primary transition-colors">
                  Trip Builder
                </Link>
              </li>
              <li>
                <Link to="/when-to-go" className="text-text-muted hover:text-text-primary transition-colors">
                  When to Go
                </Link>
              </li>
              <li>
                <Link to="/trip-planner" className="text-text-muted hover:text-text-primary transition-colors">
                  Budget Planner
                </Link>
              </li>
            </ul>
          </div>

          {/* Flexbook column */}
          <div>
            <h4 className="text-sm font-bold text-text-primary mb-4">Flexbook</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/about" className="text-text-muted hover:text-text-primary transition-colors">
                  How it works
                </Link>
              </li>
              <li>
                <Link to={sampleTripHref()} className="text-text-muted hover:text-text-primary transition-colors">
                  Sample trip
                </Link>
              </li>
              <li>
                <Link to="/tools" className="text-text-muted hover:text-text-primary transition-colors">
                  All tools
                </Link>
              </li>
            </ul>
          </div>

          {/* Free forever column */}
          <div>
            <h4 className="text-sm font-bold text-text-primary mb-4">Free forever</h4>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange/10 border border-orange/20 text-xs font-semibold text-orange">
              <Sparkles size={11} />
              No login required
            </span>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border/40 text-xs text-text-muted/80">
          © {new Date().getFullYear()} Flexbook.space · Built for budget travelers
        </div>
      </div>
    </footer>
  );
}
