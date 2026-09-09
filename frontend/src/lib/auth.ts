const TOKEN_KEY = 'kernabase-token';
const LEGACY_TOKEN_KEY = 'mydb-studio-token';

export function getToken(): string | null {
  try {
    const token = window.localStorage.getItem(TOKEN_KEY) ?? window.localStorage.getItem(LEGACY_TOKEN_KEY);
    if (token && !window.localStorage.getItem(TOKEN_KEY)) window.localStorage.setItem(TOKEN_KEY, token);
    return token;
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // localStorage unavailable — session just won't persist across reloads.
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(LEGACY_TOKEN_KEY);
  } catch {
    // ignore
  }
}
