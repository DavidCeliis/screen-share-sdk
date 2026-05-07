import { useState, useCallback, useEffect } from 'react';
import { setThemeMode, subscribeToTheme } from '../styles/theme';
import type { ResolvedTheme } from '../styles/theme';

/**
 * React hook for `custom` themeMode.
 *
 * Returns [currentTheme, setTheme]. Calling setTheme propagates the change
 * to all SDK overlays/toasts currently rendered (React and vanilla JS alike).
 *
 * @example
 * const [theme, setTheme] = useThemeMode('dark');
 * <ScreenShareButton themeMode="custom" />
 * <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>Toggle</button>
 */
export function useThemeMode(
  initial: ResolvedTheme = 'dark',
): [ResolvedTheme, (t: ResolvedTheme) => void] {
  const [theme, setLocal] = useState<ResolvedTheme>(initial);

  useEffect(() => {
    return subscribeToTheme(setLocal);
  }, []);

  const set = useCallback((t: ResolvedTheme) => {
    setThemeMode(t); // propagates via subscribers + DOM
  }, []);

  return [theme, set];
}
