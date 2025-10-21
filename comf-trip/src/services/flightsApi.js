// src/services/flightsApiAmadeus.js
// Combined: Amadeus for flight offers (corrected request body), OurAirports CSV for airports (IATA-only)

const PROXY_BASE = process.env.REACT_APP_API_PROXY || '';
const CLIENT_ID = process.env.REACT_APP_AMADEUS_CLIENT_ID || 'Urt92w3G17hRECySlIsH5pyZHXDzcUr9';
const CLIENT_SECRET = process.env.REACT_APP_AMADEUS_CLIENT_SECRET || '13l2GscINoAUMiA0';
const AMADEUS_AUTH_URL = 'https://test.api.amadeus.com/v1/security/oauth2/token';
const AMADEUS_BASE = 'https://test.api.amadeus.com';

const OURAIRPORTS_PRIMARY = 'https://ourairports.com/airports.csv';
const OURAIRPORTS_FALLBACK = 'https://davidmegginson.github.io/ourairports-data/airports.csv';

function shouldUseProxy() {
  if (!PROXY_BASE) return false;
  if (typeof window !== 'undefined' && PROXY_BASE.startsWith('http')) {
    try {
      const pOrigin = new URL(PROXY_BASE).origin;
      const wOrigin = window.location.origin;
      if (pOrigin === wOrigin) {
        console.warn(
          `[flightsApiAmadeus] Ignoring proxy because REACT_APP_API_PROXY (${PROXY_BASE}) points to same origin as frontend (${wOrigin}). Falling back to direct Amadeus calls.`
        );
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

// --- Shared fetch helper
async function safeFetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text().catch(() => '');
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch (e) {
    parsed = null;
  }

  if (!res.ok) {
    if (parsed && (parsed.error || parsed.errors)) {
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
  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
}

function buildProxyUrl(path, params = {}) {
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  const qs = new URLSearchParams(params).toString();
  return `${PROXY_BASE}${cleanPath}${qs ? '?' + qs : ''}`;
}

// --- Amadeus auth + internalGet/internalPost
let cachedToken = null;

async function getAccessTokenFrontend() {
  const now = Date.now();
  if (cachedToken && cachedToken.expires_at && cachedToken.expires_at > now + 5000) {
    return cachedToken.access_token;
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error(
      'Amadeus CLIENT_ID/CLIENT_SECRET missing. Set REACT_APP_AMADEUS_CLIENT_ID and REACT_APP_AMADEUS_CLIENT_SECRET in your frontend .env (dev only), or configure a server proxy and set REACT_APP_API_PROXY.'
    );
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

async function internalGet(path, params = {}) {
  const safeParams = {};
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === 'object' && !(v instanceof String)) {
      try {
        safeParams[k] = JSON.stringify(v);
      } catch {
        safeParams[k] = String(v);
      }
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
  return safeFetchJson(url, { method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
}

/**
 * internalPost: handles POST requests (used for /v2/shopping/flight-offers)
 * If USE_PROXY -> proxy should accept POST at the same path and forward accordingly.
 * Otherwise attach Bearer token and POST to Amadeus.
 */
async function internalPost(path, body = {}) {
  if (USE_PROXY) {
    const url = buildProxyUrl(path);
    return safeFetchJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body)
    });
  }

  const token = await getAccessTokenFrontend();
  const url = `${AMADEUS_BASE}${path}`;
  return safeFetchJson(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
}

/* -----------------------------
   OurAirports CSV loader & helpers (IATA-only)
   ----------------------------- */

let _ourAirportsLoaded = false;
let _ourAirportsList = [];
let _ourAirportsIndex = {
  byIata: new Map(),
  byCity: new Map(),
  byName: []
};

function splitCsvLine(line) {
  const parts = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  return parts.map(p => {
    const s = p.trim();
    if (s.startsWith('"') && s.endsWith('"')) {
      return s.slice(1, -1).replace(/""/g, '"');
    }
    return s;
  });
}

async function fetchOurAirportsCsvText() {
  if (USE_PROXY) {
    try {
      const url = buildProxyUrl('/ourairports/airports.csv');
      const res = await fetch(url, { method: 'GET', headers: { Accept: 'text/csv' } });
      if (!res.ok) throw new Error(`Proxy returned ${res.status}`);
      return await res.text();
    } catch (err) {
      console.warn('fetchOurAirportsCsvText proxy failed, falling back to public hosts:', err);
    }
  }

  // Preferir hosts que suelen ser más fiables (fallback primero), y añadir raw.githubusercontent como alternativa
  const candidates = [
    OURAIRPORTS_FALLBACK, // github.io mirror (más estable)
    'https://raw.githubusercontent.com/davidmegginson/ourairports-data/master/airports.csv',
    OURAIRPORTS_PRIMARY   // intento final (puede fallar por cert)
  ];

  for (const u of candidates) {
    try {
      // intentar fetch; el navegador ya bloqueará si hay error de certificado
      const res = await fetch(u, { method: 'GET', headers: { Accept: 'text/csv' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${u}`);
      const text = await res.text();
      if (text && text.length > 100) return text;
      console.warn(`fetchOurAirportsCsvText: fetched ${u} but content too small`);
    } catch (err) {
      console.warn(`fetchOurAirportsCsvText: failed to fetch ${u}:`, err);
      // si el error fue ERR_CERT_DATE_INVALID lo verás en la consola del navegador; aquí simplemente seguimos
    }
  }

  throw new Error('Could not fetch OurAirports CSV from proxy or public hosts (CORS, cert or network issue). Use PROXY_BASE to fetch/cache the CSV server-side.');
}


function normalizeHeaderKey(k) {
  return String(k || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

async function loadOurAirportsCsv(force = false) {
  if (_ourAirportsLoaded && !force) return _ourAirportsList;

  const txt = await fetchOurAirportsCsvText();
  const lines = txt.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (!lines || lines.length < 2) {
    _ourAirportsLoaded = false;
    _ourAirportsList = [];
    throw new Error('OurAirports CSV appears empty or malformed');
  }

  const headerParts = splitCsvLine(lines.shift());
  const headers = headerParts.map(normalizeHeaderKey);

  const parsed = lines.map(line => {
    const cols = splitCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cols[i] !== undefined ? cols[i] : '';
    });
    return obj;
  });

  // keep only rows with non-empty 1-3 char IATA
  const filtered = parsed.filter(row => {
    const iataCandidates = (row.iata_code || row.iata || '').trim();
    return !!iataCandidates && /^[A-Za-z0-9]{1,3}$/.test(iataCandidates);
  });

  _ourAirportsList = filtered;

  _ourAirportsIndex = { byIata: new Map(), byCity: new Map(), byName: [] };
  filtered.forEach(a => {
    const iata = (a.iata || a.iata_code || '').toUpperCase();
    const city = (a.municipality || a.city || '').toLowerCase();
    if (iata) _ourAirportsIndex.byIata.set(iata, a);
    if (city) {
      const arr = _ourAirportsIndex.byCity.get(city) || [];
      arr.push(a);
      _ourAirportsIndex.byCity.set(city, arr);
    }
    _ourAirportsIndex.byName.push(a);
  });

  _ourAirportsLoaded = true;
  return _ourAirportsList;
}

/* -----------------------------
   Airport search & helpers (OurAirports-backed)
   ----------------------------- */

function mapOurAirportRowToResp(row) {
  const lat = parseFloat(row.latitude_deg || row.latitude || '') || null;
  const lon = parseFloat(row.longitude_deg || row.longitude || '') || null;
  const iata = (row.iata || row.iata_code || '').trim();
  const municipality = row.municipality || row.city || '';
  const country = row.iso_country || row.country || '';

  return {
    id: row.id || row.ident || `${iata || (row.name || '')}`.trim(),
    type: row.type || 'airport',
    name: row.name || '',
    iata: iata,
    cityName: municipality || '',
    countryName: country || '',
    geoCode: (lat && lon) ? { latitude: lat, longitude: lon } : null,
    raw: row
  };
}

export async function searchAirportsByCity(keywordOrObj, limit = 20, countryCode) {
  let keyword = '';
  if (!keywordOrObj) return [];
  if (typeof keywordOrObj === 'string') keyword = keywordOrObj;
  else if (typeof keywordOrObj === 'object' && keywordOrObj.keyword) keyword = keywordOrObj.keyword;
  else keyword = String(keywordOrObj);

  keyword = keyword.replace(/[(),]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!keyword || keyword.length < 1) return [];

  try {
    await loadOurAirportsCsv();
  } catch (err) {
    console.error('searchAirportsByCity: failed to load OurAirports CSV:', err);
    return [];
  }

  const q = keyword.toLowerCase();

  if (q.length === 3) {
    const iata = q.toUpperCase();
    const row = _ourAirportsIndex.byIata.get(iata);
    if (row) {
      if (countryCode) {
        const ccUpper = String(countryCode).toUpperCase();
        if ((row.iso_country || '').toUpperCase() !== ccUpper) {
          // continue to broad search
        } else {
          return [mapOurAirportRowToResp(row)];
        }
      } else {
        return [mapOurAirportRowToResp(row)];
      }
    }
  }

  const results = [];
  const max = Math.max(5, Math.min(limit || 20, 200));
  for (const row of _ourAirportsIndex.byName) {
    if (results.length >= max) break;
    const iata = ((row.iata || row.iata_code || '') + '').toLowerCase();
    const name = (row.name || '').toLowerCase();
    const city = (row.municipality || row.city || '').toLowerCase();
    const ident = (row.ident || row.local_code || '').toLowerCase();
    const country = (row.iso_country || row.country || '').toLowerCase();

    if (countryCode && String(countryCode || '').trim().length > 0) {
      const cc = String(countryCode).toLowerCase();
      if (!(country === cc || (row.country && String(row.country).toLowerCase().includes(cc)))) {
        continue;
      }
    }

    if (
      iata.includes(q) ||
      name.includes(q) ||
      city.includes(q) ||
      ident.includes(q) ||
      (row.keywords || '').toLowerCase().includes(q)
    ) {
      results.push(mapOurAirportRowToResp(row));
    }
  }

  return results.slice(0, limit);
}

export async function getAirportsByCountry(countryCode, cityName = '', limit = 50) {
  if (!countryCode) return [];

  try {
    await loadOurAirportsCsv();
  } catch (err) {
    console.error('getAirportsByCountry: failed to load OurAirports CSV:', err);
    return [];
  }

  const cc = String(countryCode).toUpperCase();
  const cityQ = String(cityName || '').toLowerCase().trim();
  const max = Math.max(5, Math.min(limit || 50, 1000));

  const out = [];
  for (const row of _ourAirportsList) {
    if (out.length >= max) break;
    const iso = (row.iso_country || row.country || '').toUpperCase();
    if (iso !== cc) continue;
    if (cityQ) {
      const city = (row.municipality || row.city || '').toLowerCase();
      if (!city.includes(cityQ)) continue;
    }
    out.push(mapOurAirportRowToResp(row));
  }

  return out;
}

export async function getAirportOptionsForSelect(keyword, limit = 20, countryCode, cityName) {
  if (countryCode) {
    try {
      const items = await getAirportsByCountry(countryCode, cityName || keyword || '', limit);
      return items.map(a => ({
        value: a.iata || a.id,
        label: `${a.iata ? a.iata + ' — ' : ''}${a.name || ''}${a.cityName ? ` (${a.cityName}${a.countryName ? ', ' + a.countryName : ''})` : ''}`,
        meta: a
      }));
    } catch (err) {
      console.warn('getAirportOptionsForSelect: getAirportsByCountry failed, falling back to search', err);
    }
  }

  const items = await searchAirportsByCity(keyword, limit, countryCode);
  return items.map(a => ({
    value: a.iata || a.id,
    label: `${a.iata ? a.iata + ' — ' : ''}${a.name || ''}${a.cityName ? ` (${a.cityName}${a.countryName ? ', ' + a.countryName : ''})` : ''}`,
    meta: a
  }));
}

/* -----------------------------
   Amadeus flight search (proper POST body, fixed)
   ----------------------------- */

export async function searchFlights({
  originLocationCode,
  destinationLocationCode,
  departureDate,
  returnDate,
  adults = 1,
  travelClass = 'ECONOMY',
  max = 10
} = {}) {
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
    const s = String(d);
    const match = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    return s;
  };

  const depDate = fmt(departureDate);
  const retDate = returnDate ? fmt(returnDate) : null;

  // Build Amadeus v2 flight-offers request body
  // NOTE: Amadeus requires departureDateTimeRange (or arrivalDateTimeRange) and when
  // using cabinRestrictions you must include originDestinationIds referencing the originDestinations' ids.
  const originDestinations = [
    {
      id: '1',
      originLocationCode: originLocationCode,
      destinationLocationCode: destinationLocationCode,
      // use departureDateTimeRange with a date (Amadeus accepts { date: 'YYYY-MM-DD' })
      departureDateTimeRange: { date: depDate }
    }
  ];

  if (retDate) {
    originDestinations.push({
      id: '2',
      originLocationCode: destinationLocationCode,
      destinationLocationCode: originLocationCode,
      departureDateTimeRange: { date: retDate }
    });
  }

  // travelers array: create ADULT travelers based on 'adults'
  const travelers = [];
  const nAdults = Math.max(1, parseInt(adults || 1, 10));
  for (let i = 1; i <= nAdults; i++) {
    travelers.push({ id: String(i), travelerType: 'ADULT' });
  }

  // searchCriteria: include maxFlightOffers
  const searchCriteria = {
    maxFlightOffers: Math.max(1, Math.min(parseInt(max || 10, 10), 250))
  };

  // optional: add cabin restrictions only if travelClass provided.
  // Must include originDestinationIds referencing originDestinations[].id
  if (travelClass) {
    const cabin = String(travelClass).toUpperCase();
    searchCriteria.flightFilters = {
      cabinRestrictions: [
        {
          cabin,
          coverage: 'MOST_SEGMENTS',
          originDestinationIds: originDestinations.map(od => od.id) // e.g. ['1'] or ['1','2']
        }
      ]
    };
  }

  const body = {
    originDestinations,
    travelers,
    sources: ['GDS'], // sandbox generally requires sources
    searchCriteria
  };

  // debug printing if you set DEBUG_AMADEUS=true in env (helpful for dev only)
  try {
    if (typeof process !== 'undefined' && process.env && process.env.DEBUG_AMADEUS === 'true') {
      // eslint-disable-next-line no-console
      console.debug('[Amadeus] flight-offers request body:', JSON.stringify(body, null, 2));
    }
  } catch (e) {
    // ignore
  }

  try {
    const raw = await internalPost('/v2/shopping/flight-offers', body);
    return raw;
  } catch (err) {
    // if Amadeus returned structured body in err.body, include it to make debugging easier
    if (err && err.body && err.body.errors) {
      // preserve thrown error (but include full body as string)
      throw new Error(`Amadeus flight search failed: ${JSON.stringify(err.body.errors)}`);
    }
    throw err;
  }
}

/**
 * Try to fetch a single flight "offer" by its id.
 *
 * Strategy:
 * 1) If a proxy/ backend is configured (USE_PROXY or PROXY_BASE), call the backend:
 *    GET ${PROXY_BASE}/flights/:flight_id/offer  (proxy should forward to server)
 * 2) Else attempt to call Amadeus directly. Amadeus doesn't always expose a stable
 *    GET-by-id for v2 flight-offers, so this is a best-effort fallback.
 *
 * Returns the raw offer object (same shape as items returned by searchFlights()) or null if not found.
 */
export async function getOfferById(flightId) {
  if (!flightId) return null;
  const fid = String(flightId).trim();

  // Helpers
  const todayIso = () => new Date().toISOString().split('T')[0];
  const safeDateFromMatch = (m) => (m && m[0]) ? m[0] : null;

  // 1) try to detect a date token yyyy-mm-dd anywhere in the id
  const dateMatch = fid.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  let scheduledDepartureDate = safeDateFromMatch(dateMatch);

  // 2) try to parse carrier + flightNumber from common formats:
  //    - "TP487"
  //    - "TP487_2023-08-01"
  //    - "TP|487|2023-08-01"
  //    - "TP-487" or "TP 487"
  let carrier = null;
  let flightNumber = null;

  // attempt: leading letters then digits (e.g. TP487)
  let m = fid.match(/^([A-Za-z]{2,3})(\d{1,4})/);
  if (!m) {
    // attempt other separators (TP|487, TP-487, "TP 487")
    m = fid.match(/([A-Za-z]{2,3})\D+?(\d{1,4})/);
  }
  if (m) {
    carrier = (m[1] || "").toUpperCase();
    flightNumber = String(m[2] || "");
  } else {
    // as last resort, if fid is like "487" alone (unlikely) return null
    return null;
  }

  // If no parsed date, try tokens split by '|' or '_' etc to find a yyyy-mm-dd token
  if (!scheduledDepartureDate) {
    const tokens = fid.split(/[\|_\s\-]+/).map(t => t.trim()).filter(Boolean);
    for (const t of tokens) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
        scheduledDepartureDate = t;
        break;
      }
    }
  }

  // fallback to today if still no date (Amadeus requires scheduledDepartureDate)
  if (!scheduledDepartureDate) scheduledDepartureDate = todayIso();

  // Build schedule endpoint URL (call Amadeus directly — do not use internalGet/proxy here)
  const path = `/v2/schedule/flights?carrierCode=${encodeURIComponent(carrier)}&flightNumber=${encodeURIComponent(flightNumber)}&scheduledDepartureDate=${encodeURIComponent(scheduledDepartureDate)}`;
  const url = `${AMADEUS_BASE}${path}`;

  try {
    // Get token and call Amadeus directly (ensures we are calling Amadeus only)
    const token = await getAccessTokenFrontend();
    const raw = await safeFetchJson(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    }).catch(() => null);

    if (!raw) return null;

    // Amadeus returns { meta:..., data: [ DatedFlight, ... ] }
    const df = (raw.data && Array.isArray(raw.data) && raw.data.length) ? raw.data[0] : (Array.isArray(raw) && raw.length ? raw[0] : raw);
    if (!df) return null;

    // Build a map of flightPoints (iataCode -> flightPoint) for quick lookup of timings
    const fpMap = {};
    if (Array.isArray(df.flightPoints)) {
      df.flightPoints.forEach(fp => {
        if (fp && fp.iataCode) fpMap[String(fp.iataCode).toUpperCase()] = fp;
      });
    }

    // Convert schedule segments into itineraries[0].segments[] with departure.at / arrival.at etc.
    const segments = (Array.isArray(df.segments) ? df.segments : []).map(seg => {
      const board = seg.boardPointIataCode || seg.boardPoint || null;
      const off = seg.offPointIataCode || seg.offPoint || null;
      const depFP = board ? fpMap[String(board).toUpperCase()] : null;
      const arrFP = off ? fpMap[String(off).toUpperCase()] : null;

      // Prefer STD/STA qualifier timings, otherwise pick first timing value
      const depTime = depFP?.departure?.timings?.find(t => String(t.qualifier || '').toUpperCase() === 'STD')?.value
        || depFP?.departure?.timings?.[0]?.value
        || null;
      const arrTime = arrFP?.arrival?.timings?.find(t => String(t.qualifier || '').toUpperCase() === 'STA')?.value
        || arrFP?.arrival?.timings?.[0]?.value
        || null;

      // operating flight if present
      const operating = seg.partnership?.operatingFlight || seg.operating || null;
      const carrierCode = operating?.carrierCode || df.flightDesignator?.carrierCode || null;
      const flightNumberOper = operating?.flightNumber || df.flightDesignator?.flightNumber || null;

      return {
        carrierCode,
        number: flightNumberOper,
        departure: { iataCode: board || (depFP && depFP.iataCode) || null, at: depTime },
        arrival: { iataCode: off || (arrFP && arrFP.iataCode) || null, at: arrTime },
        duration: seg.scheduledSegmentDuration || seg.scheduledLegDuration || null,
        raw: seg
      };
    });

    const itineraries = [{ segments }];

    // Create an offer-like object so existing front-end mapping can consume it (shows times, airports)
    const offerLike = {
      id: `${carrier}${flightNumber}_${scheduledDepartureDate}`,
      itineraries,
      segments, // convenience
      raw: df,
      meta: {
        flightCode: `${carrier}${flightNumber}`,
        scheduledDepartureDate
      }
    };

    return offerLike;
  } catch (err) {
    console.warn('[flightsApi] getOfferById schedule call failed', err);
    return null;
  }
}




export default {
  searchAirportsByCity,
  getAirportOptionsForSelect,
  getAirportsByCountry,
  searchFlights,
  getOfferById
};
