import NodeCache from 'node-cache';
import crypto from 'crypto';
import { Itinerary } from '@fast-travel/shared';

export const tripCache = new NodeCache({ stdTTL: 2592000 }); // 30 days

export function generateTripSlug(itinerary: Itinerary): string {
  const origin = itinerary.origin.iata.toLowerCase();
  const outboundLegs = itinerary.legs.filter((l) => !l.isReturn);
  const dests = outboundLegs.map((l) => l.destinationIata.toLowerCase()).join('-');
  const firstLeg = itinerary.legs[0];
  const date = firstLeg
    ? new Date(firstLeg.departureDatetime)
        .toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        .toLowerCase()
        .replace(' ', '')
        .replace(',', '')
    : '';
  const suffix = crypto.randomBytes(3).toString('base64url').slice(0, 4);
  return [origin, dests, date, suffix].filter(Boolean).join('-');
}
