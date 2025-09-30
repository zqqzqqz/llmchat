import { useCallback, useEffect, useRef } from 'react';
import { create } from 'zustand';
import { translations, type SupportedLocale } from './translations';

type LocaleState = {
  locale: SupportedLocale;
  setLocale: (next: SupportedLocale) => void;
};

const STORAGE_KEY = 'llmchat.locale';

const store = create<LocaleState>((set) => ({
  locale: 'zh-CN',
  setLocale: (next) => {
    set({ locale: next });
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  },
}));

function renderTranslation(
  locale: SupportedLocale,
  key: string,
  values?: Record<string, string | number | undefined>
) {
  const dictionary = translations[locale] || {};
  const template = dictionary[key] ?? key;
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = values[token];
    return value === undefined || value === null ? '' : String(value);
  });
}

export function translate(
  key: string,
  values?: Record<string, string | number | undefined>,
  options?: { fallback?: string }
) {
  const { locale } = store.getState();
  const fallback = options?.fallback ?? key;
  const dictionary = translations[locale] || {};
  const template = dictionary[key] ?? fallback;
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, token: string) => {
    const value = values[token];
    return value === undefined || value === null ? '' : String(value);
  });
}

export function useI18n() {
  const locale = store((state) => state.locale);
  const setLocale = store((state) => state.setLocale);
  const t = useCallback(
    (
      key: string,
      values?: Record<string, string | number | undefined>,
      options?: { fallback?: string }
    ) => renderTranslation(locale, key, values) || options?.fallback || key,
    [locale]
  );

  return {
    locale,
    setLocale,
    availableLocales: [
      { code: 'zh-CN' as SupportedLocale, label: '中文' },
      { code: 'en-US' as SupportedLocale, label: 'English' },
    ],
    t,
  };
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const hydratedRef = useRef(false);
  const setLocale = store((state) => state.setLocale);
  const locale = store((state) => state.locale);

  useEffect(() => {
    if (typeof window === 'undefined' || hydratedRef.current) return;
    hydratedRef.current = true;
    const stored = window.localStorage.getItem(STORAGE_KEY) as SupportedLocale | null;
    if (stored && stored !== locale) {
      setLocale(stored);
      return;
    }
    if (!stored) {
      const browser = window.navigator.language.toLowerCase().startsWith('zh')
        ? 'zh-CN'
        : 'en-US';
      setLocale(browser as SupportedLocale);
    }
  }, [locale, setLocale]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return <>{children}</>;
}
