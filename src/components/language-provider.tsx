'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  defaultAppLocale,
  languageStorageKey,
  localeDetails,
  resolveAppLocale,
  type AppLocale,
} from '@/lib/i18n/locales';
import {
  translate,
  type MessageKey,
  type MessageValues,
} from '@/lib/i18n/messages';

type LanguageContextValue = {
  locale: AppLocale;
  formattingLocale: string;
  setLocale: (locale: AppLocale) => void;
  t: (key: MessageKey, values?: MessageValues) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(defaultAppLocale);

  useEffect(() => {
    let savedLocale: string | null = null;
    try {
      savedLocale = window.localStorage.getItem(languageStorageKey);
    } catch {
      // Use the browser language when storage is unavailable.
    }
    setLocaleState(resolveAppLocale(savedLocale, navigator.languages));
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: AppLocale) => {
    try {
      window.localStorage.setItem(languageStorageKey, nextLocale);
    } catch {
      // Keep the language choice for this visit.
    }
    setLocaleState(nextLocale);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      formattingLocale: localeDetails[locale].formattingLocale,
      setLocale,
      t: (key, values) => translate(locale, key, values),
    }),
    [locale, setLocale],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider.');
  }
  return context;
}
