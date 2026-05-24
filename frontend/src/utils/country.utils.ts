// Convert ISO country codes (e.g. "CY", "GE", "HUN") to display names
// ("Cyprus", "Georgia", "Hungary"). Returns the input unchanged if it's already
// a full name, empty, or "Other". Uses the browser's built-in Intl.DisplayNames
// so no network calls and no extra dependency.

let regionNames: Intl.DisplayNames | null = null;
function getRegionNames(): Intl.DisplayNames | null {
  if (regionNames) return regionNames;
  try {
    regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return regionNames;
  } catch {
    return null;
  }
}

export function countryDisplayName(input: string | undefined | null): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (trimmed === 'Other') return 'Other';

  // Treat 2- or 3-letter all-letter tokens as ISO codes and resolve them.
  const isLikelyCode = /^[A-Za-z]{2,3}$/.test(trimmed);
  if (!isLikelyCode) return trimmed;

  const dn = getRegionNames();
  if (!dn) return trimmed;
  try {
    const resolved = dn.of(trimmed.toUpperCase());
    return resolved && resolved !== trimmed.toUpperCase() ? resolved : trimmed;
  } catch {
    return trimmed;
  }
}
