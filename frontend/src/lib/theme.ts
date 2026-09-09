export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'kernabase-theme';
const LEGACY_STORAGE_KEY = 'mydb-studio-theme';

export function getStoredPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function storePreference(pref: ThemePreference): void {
  try {
    if (pref === 'system') {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, pref);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable (private mode, etc.) — theme just won't persist.
  }
}

export function applyPreference(pref: ThemePreference): void {
  const root = document.documentElement;
  if (pref === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', pref);
  }
}

export function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
