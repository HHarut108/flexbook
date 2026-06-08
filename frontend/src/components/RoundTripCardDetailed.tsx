import { FlightOption, RoundTripOption } from '@fast-travel/shared';
import { Moon } from 'lucide-react';
import {
  ActionColumn,
  DetailedTripCard,
  LegRow,
} from './FlightCardDetailed';

interface Props {
  trip: RoundTripOption;
  passengers: number;
  isBestValue?: boolean;
  logos: Record<string, string>;
  onSelect: (trip: RoundTripOption) => void;
}

function stayNights(outboundArrivalIso: string, inboundDepartureIso: string): number {
  const arrive = new Date(outboundArrivalIso);
  const depart = new Date(inboundDepartureIso);
  const ms = depart.getTime() - arrive.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function hasAnySelfTransfer(...legs: FlightOption[]): boolean {
  return legs.some((l) => l.layovers?.some((lo) => lo.selfTransfer) ?? false);
}

function logoFor(logos: Record<string, string>, code?: string): string | undefined {
  if (!code) return undefined;
  return logos[code.toUpperCase()];
}

export function RoundTripCardDetailed({
  trip,
  passengers,
  isBestValue,
  logos,
  onSelect,
}: Props) {
  const nights = stayNights(trip.outbound.arrivalDatetime, trip.inbound.departureDatetime);
  const stayCity = trip.outbound.destinationCity;
  const selfTransfer = hasAnySelfTransfer(trip.outbound, trip.inbound);

  return (
    <DetailedTripCard
      isBestValue={isBestValue}
      onSelect={() => onSelect(trip)}
      action={
        <ActionColumn
          priceUsd={trip.priceUsd}
          priceLabel="round trip · total"
          passengers={passengers}
          hasSelfTransfer={selfTransfer}
        />
      }
    >
      <LegRow
        leg={trip.outbound}
        legLabel="Outbound"
        logoUrl={logoFor(logos, trip.outbound.airlineCode)}
        carrierLogos={logos}
        isBestValue={isBestValue}
      />
      <StayDivider nights={nights} city={stayCity} />
      <LegRow
        leg={trip.inbound}
        legLabel="Return"
        logoUrl={logoFor(logos, trip.inbound.airlineCode)}
        carrierLogos={logos}
      />
    </DetailedTripCard>
  );
}

function StayDivider({ nights, city }: { nights: number; city: string }) {
  if (nights <= 0) {
    return <div className="border-t border-border/60" />;
  }
  return (
    <div
      className="flex items-center gap-2"
      aria-label={`${nights} night${nights === 1 ? '' : 's'} in ${city}`}
    >
      <div className="flex-1 border-t border-border/60" />
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-mid shrink-0">
        <Moon size={9} />
        {nights} night{nights === 1 ? '' : 's'} in {city}
      </span>
      <div className="flex-1 border-t border-border/60" />
    </div>
  );
}
