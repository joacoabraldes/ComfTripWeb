/**
 * Helper to translate category/interest slugs to localized names
 */

// Map of category slugs to translation keys
const CATEGORY_SLUG_TO_KEY = {
  'cultura': 'categories.culture',
  'gastronomia': 'categories.gastronomy',
  'naturaleza': 'categories.nature',
  'compras': 'categories.shopping',
  'deportes': 'categories.sports',
  'familia': 'categories.family',
  'fiestas': 'categories.parties',
  'relax': 'categories.relax',
};

// Map of category slugs to description translation keys
const CATEGORY_DESCRIPTION_KEY = {
  'cultura': 'categories.descriptions.culture',
  'gastronomia': 'categories.descriptions.gastronomy',
  'naturaleza': 'categories.descriptions.nature',
  'compras': 'categories.descriptions.shopping',
  'deportes': 'categories.descriptions.sports',
  'familia': 'categories.descriptions.family',
  'fiestas': 'categories.descriptions.parties',
  'relax': 'categories.descriptions.relax',
};

/**
 * Get translation key for a category slug
 */
export function getCategoryTranslationKey(slug) {
  if (!slug) return null;
  const normalizedSlug = String(slug).trim().toLowerCase();
  return CATEGORY_SLUG_TO_KEY[normalizedSlug] || null;
}

/**
 * Get translation key for a category description
 */
export function getCategoryDescriptionKey(slug) {
  if (!slug) return null;
  const normalizedSlug = String(slug).trim().toLowerCase();
  return CATEGORY_DESCRIPTION_KEY[normalizedSlug] || null;
}

/**
 * Hook to translate category names
 * Returns a memoized function that takes a slug and returns the translated name
 * Note: This must be used inside a React component that has access to useTranslation
 */
export function useCategoryTranslation() {
  // Import here to avoid circular dependencies
  const React = require('react');
  const { useTranslation } = require('../i18n');
  const { t } = useTranslation();
  
  return React.useCallback((slug, fallback) => {
    if (!slug) return fallback || '';
    const key = getCategoryTranslationKey(slug);
    if (key) {
      try {
        const translated = t(key);
        // If translation key doesn't exist, t() returns the key itself
        if (translated !== key) {
          return translated;
        }
      } catch (e) {
        // Translation key doesn't exist, use fallback
      }
    }
    return fallback || slug;
  }, [t]);
}

/**
 * Hook to translate category descriptions
 * Returns a memoized function that takes a slug and returns the translated description
 * Note: This must be used inside a React component that has access to useTranslation
 */
export function useCategoryDescriptionTranslation() {
  // Import here to avoid circular dependencies
  const React = require('react');
  const { useTranslation } = require('../i18n');
  const { t } = useTranslation();
  
  return React.useCallback((slug, fallback) => {
    if (!slug) return fallback || '';
    const key = getCategoryDescriptionKey(slug);
    if (key) {
      try {
        const translated = t(key);
        // If translation key doesn't exist, t() returns the key itself
        if (translated !== key) {
          return translated;
        }
      } catch (e) {
        // Translation key doesn't exist, use fallback
      }
    }
    return fallback || '';
  }, [t]);
}

/**
 * Direct translation function (for use outside React components)
 * Requires passing the translation function
 */
export function translateCategory(t, slug, fallback) {
  if (!slug) return fallback || '';
  const key = getCategoryTranslationKey(slug);
  if (key) {
    try {
      const translated = t(key);
      if (translated !== key) {
        return translated;
      }
    } catch (e) {
      // Translation key doesn't exist, use fallback
    }
  }
  return fallback || slug;
}

/**
 * Direct translation function for category descriptions (for use outside React components)
 * Requires passing the translation function
 */
export function translateCategoryDescription(t, slug, fallback) {
  if (!slug) return fallback || '';
  const key = getCategoryDescriptionKey(slug);
  if (key) {
    try {
      const translated = t(key);
      if (translated !== key) {
        return translated;
      }
    } catch (e) {
      // Translation key doesn't exist, use fallback
    }
  }
  return fallback || '';
}

