import React, { useState, useMemo } from 'react';
import '../../styles/phone-field.css';
import { useTranslation } from '../../i18n';
import countries from 'world-countries';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';

// Common country codes (fallback if world-countries is not available)
const COMMON_COUNTRY_CODES = [
  { code: '+1', country: 'US', name: 'United States' },
  { code: '+52', country: 'MX', name: 'Mexico' },
  { code: '+54', country: 'AR', name: 'Argentina' },
  { code: '+55', country: 'BR', name: 'Brazil' },
  { code: '+56', country: 'CL', name: 'Chile' },
  { code: '+57', country: 'CO', name: 'Colombia' },
  { code: '+34', country: 'ES', name: 'Spain' },
  { code: '+33', country: 'FR', name: 'France' },
  { code: '+39', country: 'IT', name: 'Italy' },
  { code: '+49', country: 'DE', name: 'Germany' },
  { code: '+44', country: 'GB', name: 'United Kingdom' },
];

export default function PhoneField({
  value = '',
  code = '+1',
  onCodeChange,
  onNumberChange,
  containerStyle,
  inputHeight = 50,
  placeholder,
    disabled=false,
}) {
  const { t } = useTranslation();
  const [showCodePicker, setShowCodePicker] = useState(false);
  const [search, setSearch] = useState('');
  const defaultPlaceholder = placeholder || t('auth.register.phoneNumber');

  // Extract country codes from world-countries
  const countryCodes = useMemo(() => {
    try {
      const codesMap = new Map();
      
      if (!Array.isArray(countries)) {
        throw new Error('countries is not an array');
      }
      
      countries.forEach((country) => {
        const countryName = country.name?.common || country.name?.official || country.name || '';
        const countryCode = country.cca2 || country.alpha2 || '';
        
        // world-countries uses 'idd' (International Direct Dialing) property
        // idd has structure: { root: "+1", suffixes: ["234", "567"] }
        if (country.idd && country.idd.root) {
          const root = country.idd.root.replace(/^\+/, ''); // Remove + if present
          
          if (country.idd.suffixes && Array.isArray(country.idd.suffixes) && country.idd.suffixes.length > 0) {
            // Use the first suffix to create the full code (e.g., +1 for US, +52 for Mexico)
            const firstSuffix = country.idd.suffixes[0];
            const fullCode = `${root}${firstSuffix}`;
            
            // Use country code as key to avoid duplicates (e.g., US and CA both use +1)
            if (fullCode && countryCode && !codesMap.has(countryCode)) {
              codesMap.set(countryCode, {
                code: `+${fullCode}`,
                country: countryCode,
                name: countryName,
              });
            }
          } else if (root) {
            // Some countries might only have root without suffixes
            if (countryCode && !codesMap.has(countryCode)) {
              codesMap.set(countryCode, {
                code: `+${root}`,
                country: countryCode,
                name: countryName,
              });
            }
          }
        }
      });

      // Convert to array and sort by country name
      const result = Array.from(codesMap.values()).sort((a, b) => 
        a.name.localeCompare(b.name)
      );
      
      // If no results, use fallback
      if (result.length === 0) {
        throw new Error('No country codes found');
      }
      
      return result;
    } catch (error) {
      console.error('Error processing country codes:', error);
      // Fallback to common codes
      return COMMON_COUNTRY_CODES;
    }
  }, []);

  // Filter countries based on search
  const filteredCountries = useMemo(() => {
    if (!search.trim()) {
      return countryCodes;
    }
    const searchLower = search.toLowerCase();
    return countryCodes.filter(
      (item) =>
        item.code.toLowerCase().includes(searchLower) ||
        item.country.toLowerCase().includes(searchLower) ||
        item.name.toLowerCase().includes(searchLower)
    );
  }, [countryCodes, search]);

  return (
    <div className="phone-field-container" style={containerStyle}>
      <div className="phone-input-row" style={{ height: `${inputHeight}px` }}>
        <button
          type="button"
          className="code-button"
          onClick={() => setShowCodePicker(!showCodePicker)}
          disabled={disabled}
        >
          <span className="code-text">{code}</span>
          <span className="code-arrow">
            {showCodePicker ? <FaChevronUp /> : <FaChevronDown />}
          </span>
        </button>
        <div className="phone-divider" />
        <input
          type="tel"
          className="phone-number-input"
          value={value}
          onChange={(e) => {
            // Solo permitir números
            const numericValue = e.target.value.replace(/\D/g, '');
            onNumberChange?.(numericValue);
          }}
          placeholder={defaultPlaceholder}
          onFocus={() => setShowCodePicker(false)}
          disabled={disabled}
        />
      </div>
      {showCodePicker && !disabled && (
        <div className="code-dropdown">
          <div className="code-search-container">
            <input
              type="text"
              className="code-search-input"
              placeholder="Buscar país o código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
          <div className="code-list">
            {filteredCountries.length > 0 ? (
              filteredCountries.map((item) => (
                <button
                  key={`${item.code}-${item.country}`}
                  type="button"
                  className={`code-item ${code === item.code ? 'selected' : ''}`}
                  onClick={() => {
                    onCodeChange?.(item.code);
                    setShowCodePicker(false);
                    setSearch('');
                  }}
                >
                  <span className="code-item-text">
                    {item.code} {item.country} - {item.name}
                  </span>
                </button>
              ))
            ) : (
              <div className="code-no-results">
                <span className="code-no-results-text">No se encontraron resultados</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

