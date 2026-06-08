import { Fragment } from 'react';
import { FlightOption, MultiCityOption } from '@fast-travel/shared';
import { Moon } from 'lucide-react';
import {
  ActionColumn,
  DetailedTripCard,
  LegRow,
} from './FlightCardDetailed';

interface Props {
  trip: MultiCityOption;
  passengers: number;
  isBestValue?: boolean;
  logos: Record<string, string>;
  onSelect: (trip: MultiCityOption) => void;
}

function stayNights(arrivalIso: string, nextDepartureIso: string): number {
  const arrive = new Date(arrivalIso);
  const depart = new Date(nextDepartureIso);
  const ms = depart.getTime() - arrive.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function hasAnySelfTransfer(legs: FlightOption[]): boolean {
  return legs.some((l) => l.layovers?.some((lo) => lo.selfTransfer) ?? false);
}

function logoFor(logos: Record<string, string>, code?: string): string | undefined {
  if (!code) return undefined;
  return logos[code.toUpperCase()];
}

export function MultiCityCardDetailed({
  trip,
  passengers,
  isBestValue,
  logos,
  onSelect,
}: Props) {
  const selfTransfer = hasAnySelfTransfer(trip.legs);

  return (
    <DetailedTripCard
      isBestValue={isBestValue}
      onSelect={() => onSelect(trip)}
      action={
        <ActionColumn
          priceUsd={trip.priceUsd}
          priceLabel={`${trip.legs.length} legs · total`}
          passengers={passengers}
          hasSelfTransfer={selfTransfer}
          separateTickets
        />
      }
    >
      {trip.legs.map((leg, i) => {
        const nextLeg = trip.legs[i + 1];
        const nights = nextLeg ? stayNights(leg.arrivalDatetime, nextLeg.departureDatetime) : 0;
        return (
          <Fragment key={leg.flightId}>
            <LegRow
              leg={leg}
              legLabel={`Leg ${i + 1}`}
              logoUrl={logoFor(logos, leg.airlineCode)}
              isBestValue={isBestValue && i === 0}
            />
            {nextLeg && <StayDivider nights={nights} city={leg.destinationCity} />}
          </Fragment>
        );
      })}
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
