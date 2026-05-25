import { useState, useCallback, useEffect } from 'react';
import { setLocale, subscribeToLocale, getResolvedLocale, t } from '../i18n';
import type { Locale, ResolvedLocale } from '../i18n';

export function useLocale(): [ResolvedLocale, (locale: Locale) => void, typeof t] {
  const [locale, setLocal] = useState<ResolvedLocale>(getResolvedLocale);

  useEffect(() => {
    setLocal(getResolvedLocale());
    return subscribeToLocale(setLocal);
  }, []);

  const set = useCallback((locale: Locale) => {
    setLocale(locale);
  }, []);

  return [locale, set, t];
}
