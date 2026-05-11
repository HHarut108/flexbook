export const DEFAULT_FETCH_TIMEOUT_MS = 15000;

export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  return fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}
