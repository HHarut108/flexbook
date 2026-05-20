import { useEffect } from 'react';
import { FlightOption } from '@fast-travel/shared';
import { Plane, X, MapPin } from 'lucide-react';
import { formatPrice } from '../utils/price.utils';
import { formatDate } from '../utils/date.utils';

interface Props {
  destination: {
    iata: string;
    city: string;
    country: string;
    minPriceUsd: number;
    flightCount: number;
  };
  cheapestFlight: FlightOption | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DestinationConfirmModal({ destination, cheapestFlight, onConfirm, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dest-confirm-title"
    >
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-sm rounded-2xl bg-surface border border-border shadow-2xl p-5">
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-xl text-text-muted hover:bg-indigo-soft hover:text-indigo transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3 mb-4 pr-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-soft border border-indigo-border flex items-center justify-center shrink-0">
            <MapPin size={18} className="text-indigo" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-indigo-mid font-mono mb-0.5">
              Next destination
            </p>
            <h3
              id="dest-confirm-title"
              className="text-lg font-bold text-text-primary leading-tight truncate"
            >
              {destination.city}
            </h3>
            <p className="text-xs text-text-muted">
              {destination.country} · {destination.iata}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-surface-2/60 border border-border/60 px-3 py-3 mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-text-muted mb-0.5">From</p>
            <p className="font-mono text-orange font-bold text-xl leading-none">
              {formatPrice(destination.minPriceUsd)}
            </p>
          </div>
          <div className="text-right text-[11px] text-text-muted leading-tight">
            <p className="flex items-center justify-end gap-1">
              <Plane size={11} /> {destination.flightCount} direct {destination.flightCount === 1 ? 'flight' : 'flights'}
            </p>
            {cheapestFlight && (
              <p className="mt-0.5">{formatDate(cheapestFlight.departureDatetime.slice(0, 10))}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn-outline py-2.5 px-4 text-sm flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!cheapestFlight}
            className="btn-primary py-2.5 px-4 text-sm flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Fly here →
          </button>
        </div>
      </div>
    </div>
  );
}
