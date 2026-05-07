export type ThemeMode = 'auto' | 'light' | 'dark' | 'custom';
export type ResolvedTheme = 'light' | 'dark';

let _customTheme: ResolvedTheme = 'dark';
let _lastThemeAttr: string | undefined;
const _subscribers = new Set<(t: ResolvedTheme) => void>();

/** Call in `custom` mode to change the active theme globally. */
export function setThemeMode(theme: ResolvedTheme): void {
  _customTheme = theme;
  _lastThemeAttr = theme;
  _subscribers.forEach(fn => fn(theme));
  // Update all vanilla overlays/toasts currently in custom mode
  document.querySelectorAll<HTMLElement>('[data-sssdk-custom]').forEach(el => {
    el.setAttribute('data-theme', theme);
  });
}

/** Subscribe to custom-mode theme changes (React use). Returns unsubscribe fn. */
export function subscribeToTheme(fn: (t: ResolvedTheme) => void): () => void {
  _subscribers.add(fn);
  return () => _subscribers.delete(fn);
}

export function getCustomTheme(): ResolvedTheme {
  return _customTheme;
}

/**
 * Resolves the data-theme attribute value for an element.
 * Returns undefined for 'auto' (CSS media query handles it).
 */
export function resolveThemeAttr(mode: ThemeMode): string | undefined {
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  if (mode === 'custom') return _customTheme;
  return undefined;
}

/**
 * Applies the theme to a DOM element (overlay / toast container).
 * Marks custom-mode elements so setThemeMode can update them live.
 */
export function applyTheme(el: HTMLElement, mode: ThemeMode): void {
  const attr = resolveThemeAttr(mode);
  if (attr) {
    el.setAttribute('data-theme', attr);
  } else {
    el.removeAttribute('data-theme');
  }
  if (mode === 'custom') {
    el.setAttribute('data-sssdk-custom', '');
  } else {
    el.removeAttribute('data-sssdk-custom');
  }
  _lastThemeAttr = attr;
}

/** Returns the last applied data-theme value (for the toast to inherit). */
export function getLastThemeAttr(): string | undefined {
  return _lastThemeAttr;
}
