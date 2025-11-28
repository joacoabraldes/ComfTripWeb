/**
 * Internationalization (i18n) configuration and utilities for React
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import esTranslations from './es';
import enTranslations from './en';

export const LanguageContext = createContext();

const translations = {
  es: esTranslations,
  en: enTranslations,
};

const LANGUAGE_STORAGE_KEY = '@comftrip:language';

/**
 * Simple template replacement function
 * Replaces {key} placeholders with values from params
 */
function replaceParams(str, params) {
  if (!params) return str;
  
  return str.replace(/\{(\w+)\}/g, (match, key) => {
    return params[key] !== undefined ? String(params[key]) : match;
  });
}

/**
 * Get translation by key path (e.g., 'trips.title' or 'common.loading')
 */
function getTranslation(translations, key, params) {
  if (!translations || typeof translations !== 'object') {
    console.warn(`Translations object is invalid for key: ${key}`);
    return key;
  }
  
  const keys = key.split('.');
  let value = translations;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // Fallback to key if translation not found
      console.warn(`Translation key not found: ${key}`, { translations, keys, currentKey: k, value });
      return key;
    }
  }
  
  if (typeof value !== 'string') {
    console.warn(`Translation value is not a string for key: ${key}`, { value, type: typeof value });
    return key;
  }
  
  return replaceParams(value, params);
}

export function LanguageProvider({ children }) {
  // Start with default language immediately, don't block render
  const [language, setLanguageState] = useState('es');

  // Load saved language preference on mount (non-blocking)
  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = () => {
    try {
      // Try to detect system language first (fast, no async needed)
      try {
        const systemLang = Intl.DateTimeFormat().resolvedOptions().locale.split('-')[0];
        if (systemLang === 'en' || systemLang === 'es') {
          setLanguageState(systemLang);
        }
      } catch (e) {
        // Ignore locale detection errors
      }

      // Then try to load saved preference (async, may fail)
      try {
        const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (saved === 'es' || saved === 'en') {
          setLanguageState(saved);
        }
      } catch (storageError) {
        // localStorage might not be available in some environments
        console.warn('Error loading language from storage:', storageError);
      }
    } catch (error) {
      // Fallback to default, don't break the app
      console.warn('Error loading language:', error);
    }
  };

  const setLanguage = (lang) => {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      setLanguageState(lang);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const t = (key, params) => {
    const currentTranslations = translations[language] || translations.es; // Fallback to Spanish
    return getTranslation(currentTranslations, key, params);
  };

  // Always render children immediately, don't wait for language load
  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Hook to use translations
 */
export function useTranslation() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}

export default translations;

