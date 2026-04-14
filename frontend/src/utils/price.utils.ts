import { TripLeg } from '@fast-travel/shared';

export function formatPrice(usd: number): string {
  return `$${usd.toFixed(0)}`;
}

export function totalPrice(legs: TripLeg[]): number {
  return legs.reduce((sum, leg) => sum + (leg.priceUsd ?? 0), 0);
}
