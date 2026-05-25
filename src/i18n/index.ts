import { en } from './locales/en';
import { cs } from './locales/cs';
import type { TranslationKey } from './locales/en';

export type Locale = 'auto' | 'en' | 'cs';
export type ResolvedLocale = 'en' | 'cs';
export type { TranslationKey };

const TRANSLATIONS: Record<ResolvedLocale, Record<TranslationKey, string>> = { en, cs };

let _currentLocale: Locale = 'auto';
let _resolvedLocale: ResolvedLocale = _resolveAuto();
const _subscribers = new Set<(locale: ResolvedLocale) => void>();

function _resolveAuto(): ResolvedLocale {
  if (typeof navigator === 'undefined') return 'en';
  const tag = navigator.language.toLowerCase();
  if (tag === 'cs' || tag.startsWith('cs-') || tag === 'sk' || tag.startsWith('sk-')) return 'cs';
  return 'en';
}

export function setLocale(locale: Locale): void {
  _currentLocale = locale;
  _resolvedLocale = locale === 'auto' ? _resolveAuto() : locale;
  _subscribers.forEach(fn => fn(_resolvedLocale));
}

export function subscribeToLocale(fn: (locale: ResolvedLocale) => void): () => void {
  _subscribers.add(fn);
  return () => _subscribers.delete(fn);
}

export function getResolvedLocale(): ResolvedLocale {
  return _resolvedLocale;
}

export function t(key: TranslationKey): string {
  return TRANSLATIONS[_resolvedLocale]?.[key] ?? TRANSLATIONS['en'][key] ?? key;
}
