const TOKEN_KEY = 'flexbook_admin_token';

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

export function storeToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function logout(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}
