const STAY_DURATION_HINTS = [
  'Most travelers stay 2–3 days. Change your mind anytime.',
  '2–3 days is the sweet spot. But you do you.',
  'A weekend feels right. Longer if the vibe hits.',
  'Stay a couple of days — or a couple of weeks.',
  'Short stopover or slow explore? Your call.',
  '2 days to taste it. 5 days to love it.',
  'Pick a pace. You can always stretch it later.',
  'No rush. Stay as long as it feels right.',
];

const DECISION_HEADLINES = [
  '{city} feels like a good chapter.',
  '{city} has a story to tell.',
  '{city} is already growing on you.',
  '{city} just made it onto the map.',
  '{city} could be the highlight.',
  '{city} is worth the detour.',
  'Stopping in {city}? Great call.',
  '{city} is the kind of place you remember.',
];

function pickStable(seed: string, options: string[]): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % options.length;
  return options[idx];
}

export function getStayDurationHint(seed: string): string {
  return pickStable(seed, STAY_DURATION_HINTS);
}

export function getDecisionHeadline(city: string, seed: string): string {
  return pickStable(seed, DECISION_HEADLINES).replace('{city}', city);
}
