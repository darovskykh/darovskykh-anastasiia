import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import translationsUk from '@/locales/uk.json';
import translationsEn from '@/locales/en.json';
import translationsAr from '@/locales/ar.json';
import translationsEs from '@/locales/es.json';
import translationsPt from '@/locales/pt.json';
import translationsRu from '@/locales/ru.json';

export type Language = 'uk' | 'en' | 'ar' | 'es' | 'pt' | 'ru';

export const SUPPORTED_LANGUAGES: Language[] = ['uk', 'en', 'ar', 'es', 'pt', 'ru'];

// The one list of languages we offer, with how each is written in itself.
// Lives here next to SUPPORTED_LANGUAGES so the header switcher and the case
// intro's language step cannot drift apart.
export const LANGUAGE_OPTIONS: { code: Language; label: string; native: string }[] = [
  { code: 'en', label: 'EN', native: 'English' },
  { code: 'uk', label: 'UK', native: 'Українська' },
  { code: 'ar', label: 'AR', native: 'العربية' },
  { code: 'es', label: 'ES', native: 'Español' },
  { code: 'pt', label: 'PT', native: 'Português' },
  { code: 'ru', label: 'RU', native: 'Русский' },
];

if (LANGUAGE_OPTIONS.length !== SUPPORTED_LANGUAGES.length) {
  throw new Error('LANGUAGE_OPTIONS is out of sync with SUPPORTED_LANGUAGES');
}

export interface PluralForms {
  one: string;
  few: string;
  many: string;
}

export type PluralFormsByLanguage = Record<Language, PluralForms>;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  // Always resolves against English, regardless of the active UI language.
  // Used by the evaluation report, which the client requires in English for everyone.
  tEn: (key: string, params?: Record<string, string | number>) => string;
  pluralize: (n: number, forms: PluralFormsByLanguage) => string;
}

const translations: Record<Language, unknown> = {
  uk: translationsUk,
  en: translationsEn,
  ar: translationsAr,
  es: translationsEs,
  pt: translationsPt,
  ru: translationsRu,
};

const resolveTranslation = (
  lang: Language,
  key: string,
  params?: Record<string, string | number>,
): string => {
  const keys = key.split('.');
  let value: any = translations[lang];

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key;
    }
  }

  if (typeof value === 'string' && params) {
    return value.replace(/\{\{(\w+)\}\}/g, (_, paramKey) => {
      return params[paramKey]?.toString() || `{{${paramKey}}}`;
    });
  }

  return typeof value === 'string' ? value : key;
};

// Slavic plural rule (uk, ru). Returns which form key applies for n.
const slavicPluralForm = (n: number): keyof PluralForms => {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return 'one';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
  return 'many';
};

// Languages without "few" — they only distinguish singular (1) vs other.
// For these, callers pass the same string for `few` and `many`; we just pick
// `one` when n===1 and `many` otherwise (which equals `few` by convention).
const simplePluralForm = (n: number): keyof PluralForms => (n === 1 ? 'one' : 'many');

const pluralFormResolvers: Record<Language, (n: number) => keyof PluralForms> = {
  uk: slavicPluralForm,
  ru: slavicPluralForm,
  en: simplePluralForm,
  es: simplePluralForm,
  pt: simplePluralForm,
  ar: simplePluralForm,
};

const pickPluralForm = (
  lang: Language,
  n: number,
  forms: PluralFormsByLanguage,
): string => {
  const langForms = forms[lang];
  if (!langForms) {
    throw new Error(`pluralize: missing plural forms for language "${lang}"`);
  }
  const formKey = pluralFormResolvers[lang](n);
  return langForms[formKey];
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = 'app_language';

const isSupportedLanguage = (value: string): value is Language =>
  (SUPPORTED_LANGUAGES as string[]).includes(value);

// Get initial language from localStorage or browser preference
const getInitialLanguage = (): Language => {
  // Check localStorage first
  const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (storedLanguage && isSupportedLanguage(storedLanguage)) {
    return storedLanguage;
  }

  // Fallback to browser language
  const browserLanguage = navigator.language.toLowerCase();
  for (const lang of SUPPORTED_LANGUAGES) {
    if (browserLanguage.startsWith(lang)) {
      return lang;
    }
  }

  // Default to Ukrainian
  return 'uk';
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);

  // Save language to localStorage whenever it changes, and sync HTML lang.
  // We deliberately KEEP document.dir as 'ltr' even for Arabic — product
  // decision is that the page chrome (logo on the left, controls on the
  // right, menus opening from the right edge) must stay identical across
  // locales. Browsers still render individual Arabic glyphs correctly
  // inside elements via Unicode bidi without needing a document-level
  // dir flip; long Arabic paragraphs that need genuine right-aligned
  // flow can opt in per-element with dir="auto" on the wrapper.
  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = language;
    document.documentElement.dir = 'ltr';
  }, [language]);

  const t = (key: string, params?: Record<string, string | number>): string =>
    resolveTranslation(language, key, params);

  const tEn = (key: string, params?: Record<string, string | number>): string =>
    resolveTranslation('en', key, params);

  const pluralize = (n: number, forms: PluralFormsByLanguage): string =>
    pickPluralForm(language, n, forms);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, tEn, pluralize }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
