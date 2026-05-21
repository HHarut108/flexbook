const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });

export function countryNameFor(code: string): string {
  try {
    return displayNames.of(code) ?? code;
  } catch {
    return code;
  }
}
