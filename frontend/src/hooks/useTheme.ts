import { useCallback, useEffect, useState } from 'react';
import {
  applyPreference,
  getStoredPreference,
  storePreference,
  systemPrefersDark,
  type ThemePreference,
} from '../lib/theme';

function resolve(pref: ThemePreference): 'light' | 'dark' {
  return pref === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : pref;
}

export function useTheme() {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => getStoredPreference());
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => resolve(preference));

  useEffect(() => {
    applyPreference(preference);
    setResolvedTheme(resolve(preference));
  }, [preference]);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    function onChange() {
      setResolvedTheme((current) => {
        if (getStoredPreference() !== 'system') return current;
        return mql.matches ? 'dark' : 'light';
      });
    }
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    storePreference(next);
    setPreferenceState(next);
  }, []);

  return { preference, resolvedTheme, setPreference };
}
