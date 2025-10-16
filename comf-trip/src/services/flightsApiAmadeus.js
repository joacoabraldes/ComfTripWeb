// src/services/flightsApiAmadeus.js
const PROXY_BASE = process.env.REACT_APP_API_PROXY || '';
const CLIENT_ID = process.env.REACT_APP_AMADEUS_CLIENT_ID || 'Urt92w3G17hRECySlIsH5pyZHXDzcUr9';
const CLIENT_SECRET = process.env.REACT_APP_AMADEUS_CLIENT_SECRET || '13l2GscINoAUMiA0';

const AMADEUS_AUTH_URL = 'https://test.api.amadeus.com/v1/security/oauth2/token';
const AMADEUS_BASE = 'https://test.api.amadeus.com';

function shouldUseProxy() {
  if (!PROXY_BASE) return false;
  if (typeof window !== 'undefined' && PROXY_BASE.startsWith('http')) {
    try {
      const pOrigin = new URL(PROXY_BASE).origin;
      const wOrigin = window.location.origin;
      if (pOrigin === wOrigin) {
        console.warn(`[flightsApiAmadeus] Ignoring proxy because REACT_APP_API_PROXY (${PROXY_BASE}) points to same origin as frontend (${wOrigin}). Falling back to direct Amadeus calls.`);
        return false;
      }
    } catch (err) {
      console.warn('[flightsApiAmadeus] Could not parse REACT_APP_API_PROXY; ignoring proxy.', err);
      return false;
    }
  }
  return !!PROXY_BASE;
}
const USE_PROXY = shouldUseProxy();

let cachedToken = null;

async function safeFetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text().catch(() => '');
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch(e){ parsed = null; }

  if (!res.ok) {
    if (parsed && parsed.errors) {
      const msg = JSON.stringify(parsed);
      const err = new Error(`HTTP ${res.status}: ${msg}`);
      err.status = res.status;
      err.body = parsed;
      throw err;
    }
    const err = new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    err.status = res.status;
    throw err;
  }

  if (parsed !== null) return parsed;
  try { return JSON.parse(text); } catch (e) { return text; }
}

async function getAccessTokenFrontend() {
  const now = Date.now();
  if (cachedToken && cachedToken.expires_at && cachedToken.expires_at > now + 5000) {
    return cachedToken.access_token;
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Amadeus CLIENT_ID/CLIENT_SECRET missing. Set REACT_APP_AMADEUS_CLIENT_ID and REACT_APP_AMADEUS_CLIENT_SECRET in your frontend .env (dev only), or configure a server proxy and set REACT_APP_API_PROXY.');
  }

  const body = new URLSearchParams();
  body.append('grant_type', 'client_credentials');
  body.append('client_id', CLIENT_ID);
  body.append('client_secret', CLIENT_SECRET);

  const data = await safeFetchJson(AMADEUS_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  const expires_at = Date.now() + (data.expires_in || 1800) * 1000;
  cachedToken = { access_token: data.access_token, expires_at };
  return data.access_token;
}

function buildProxyUrl(path, params = {}) {
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  const qs = new URLSearchParams(params).toString();
  return `${PROXY_BASE}${cleanPath}${qs ? '?' + qs : ''}`;
}

async function internalGet(path, params = {}) {
  // sanitize params: convert non-primitive to strings or remove
  const safeParams = {};
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === 'object' && !(v instanceof String)) {
      try { safeParams[k] = JSON.stringify(v); } catch { safeParams[k] = String(v); }
    } else {
      safeParams[k] = String(v);
    }
  });

  if (USE_PROXY) {
    const url = buildProxyUrl(path, safeParams);
    return safeFetchJson(url, { method: 'GET', headers: { Accept: 'application/json' } });
  }

  const token = await getAccessTokenFrontend();
  const qs = new URLSearchParams(safeParams).toString();
  const url = `${AMADEUS_BASE}${path}${qs ? '?' + qs : ''}`;
  return safeFetchJson(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });
}

/**
 * Search airports & cities by keyword (autocomplete)
 * Accepts: (keywordOrObject, limit, countryCode)
 */
export async function searchAirportsByCity(keywordOrObj, limit = 20, countryCode) {
  let keyword = '';
  if (!keywordOrObj) return [];
  if (typeof keywordOrObj === 'string') keyword = keywordOrObj;
  else if (typeof keywordOrObj === 'object' && keywordOrObj.keyword) keyword = keywordOrObj.keyword;
  else keyword = String(keywordOrObj);

  // sanitize: remove parentheses/commas
  keyword = keyword.replace(/[(),]/g, ' ').replace(/\s+/g,' ').trim();
  if (!keyword || keyword.length < 1) return [];

  const params = {
    keyword,
    subType: 'AIRPORT,CITY',
    'page[limit]': Math.max(5, Math.min(limit, 50))
  };

  if (countryCode) params.countryCode = countryCode;

  const raw = await internalGet('/v1/reference-data/locations', params);
  const locations = raw?.data || raw?.results || [];
  return locations.map(loc => {
    const iata = loc.iataCode || '';
    const name = loc.name || loc.detailedName || (loc.address && loc.address.cityName) || '';
    return {
      id: loc.id || `${loc.type}_${iata || name}`,
      type: (loc.type || '').toLowerCase(),
      name,
      iata,
      cityName: loc.address?.cityName || '',
      countryName: loc.address?.countryName || loc.address?.countryCode || '',
      geoCode: loc.geoCode || null,
      raw: loc
    };
  });
}

/**
 * New helper: get airports by country (and optionally filter to a specific city)
 * This avoids free-text 'keyword' ambiguity and returns only airports for that country.
 *
 * NOTE: Amadeus sandbox requires a 'keyword' query param, so we provide one:
 *   - prefer cityName if given
 *   - otherwise fall back to countryCode (or an ISO2 string)
 */
export async function getAirportsByCountry(countryCode, cityName = '', limit = 50) {
  if (!countryCode) return [];

  // Amadeus sandbox requires `keyword` non-empty — prefer cityName, else use countryCode
  const keyword = (cityName && String(cityName).trim()) || String(countryCode).trim();

  // sanitize keyword
  const safeKeyword = keyword.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!safeKeyword) return [];

  const params = {
    keyword: safeKeyword,
    subType: 'AIRPORT',
    countryCode,
    'page[limit]': Math.max(5, Math.min(limit, 200))
  };

  const raw = await internalGet('/v1/reference-data/locations', params);
  const locations = raw?.data || raw?.results || [];

  // Filter further by cityName if provided (case-insensitive contains)
  const filtered = (locations || []).filter(loc => {
    const city = (loc.address && loc.address.cityName) || loc.detailedName || '';
    if (!cityName) return true;
    return city.toLowerCase().includes(String(cityName).toLowerCase());
  });

  return (filtered || []).map(loc => {
    const iata = loc.iataCode || '';
    const name = loc.name || loc.detailedName || (loc.address && loc.address.cityName) || '';
    return {
      id: loc.id || `${loc.type}_${iata || name}`,
      type: (loc.type || '').toLowerCase(),
      name,
      iata,
      cityName: loc.address?.cityName || '',
      countryName: loc.address?.countryName || loc.address?.countryCode || '',
      geoCode: loc.geoCode || null,
      raw: loc
    };
  });
}

/**
 * Return options for react-select from a keyword or from country/city
 * Accepts optional countryCode and cityName. If countryCode provided the function
 * will prefer returning airports inside that country (and filter by cityName if given).
 */
export async function getAirportOptionsForSelect(keyword, limit = 20, countryCode, cityName) {
  // When a countryCode is provided prefer fetching by country (avoids ambiguous keywords)
  if (countryCode) {
    try {
      // NOTE: getAirportsByCountry now always supplies a `keyword` param to Amadeus
      const items = await getAirportsByCountry(countryCode, cityName || keyword || '', limit);
      return items.map(a => ({
        value: a.iata || a.id,
        label: `${a.iata ? a.iata + ' — ' : ''}${a.name || ''}${a.cityName ? ` (${a.cityName}${a.countryName ? ', ' + a.countryName : ''})` : ''}`,
        meta: a
      }));
    } catch (err) {
      // fallback to keyword-based search if anything fails
      console.warn('getAirportOptionsForSelect: getAirportsByCountry failed, falling back to keyword search', err);
    }
  }

  // fallback: keyword-based search (existing behavior)
  const items = await searchAirportsByCity(keyword, limit, countryCode);
  return items.map(a => ({
    value: a.iata || a.id,
    label: `${a.iata ? a.iata + ' — ' : ''}${a.name || ''}${a.cityName ? ` (${a.cityName}${a.countryName ? ', ' + a.countryName : ''})` : ''}`,
    meta: a
  }));
}


/* flight search unchanged */
export async function searchFlights({ originLocationCode, destinationLocationCode, departureDate, returnDate, adults = 1, travelClass = 'ECONOMY', max = 10 } = {}) {
  if (!originLocationCode || !destinationLocationCode || !departureDate) {
    throw new Error('originLocationCode, destinationLocationCode and departureDate are required');
  }
  const fmt = (d) => {
    if (!d) return undefined;
    if (d instanceof Date) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return String(d);
  };

  const params = {
    originLocationCode,
    destinationLocationCode,
    departureDate: fmt(departureDate),
    adults,
    travelClass,
    max
  };
  if (returnDate) params.returnDate = fmt(returnDate);

  try {
    const raw = await internalGet('/v2/shopping/flight-offers', params);
    return raw;
  } catch (err) {
    if (err && err.body && err.body.errors) {
      throw new Error(`Amadeus flight search failed: ${JSON.stringify(err.body.errors)}`);
    }
    throw err;
  }
}

export default {
  searchAirportsByCity,
  getAirportOptionsForSelect,
  getAirportsByCountry,
  searchFlights
};
