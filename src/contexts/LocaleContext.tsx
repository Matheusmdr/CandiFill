import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  getBrowserLocale,
  loadPreferredLocale,
  Locale,
  savePreferredLocale,
  translate,
  translatePlural,
} from '../services/localization';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (message: string, values?: Record<string, string | number>) => string;
  tp: (singular: string, plural: string, count: number) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export const LocaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(getBrowserLocale);

  useEffect(() => {
    void loadPreferredLocale().then((storedLocale) => {
      if (storedLocale) setLocaleState(storedLocale);
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    void savePreferredLocale(nextLocale).catch((error: unknown) => {
      console.warn('Could not save language preference:', error);
    });
  }, []);

  const t = useCallback((message: string, values?: Record<string, string | number>) => translate(locale, message, values), [locale]);
  const tp = useCallback((singular: string, plural: string, count: number) => translatePlural(locale, singular, plural, count), [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, tp }}>
      {children}
    </LocaleContext.Provider>
  );
};

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used within LocaleProvider');
  return context;
}
