// src/services/flightsApi.js
// OurAirports CSV for airports + AeroDataBox (RapidAPI) for flights

const PROXY_BASE = process.env.REACT_APP_API_PROXY || "";

// OurAirports CSV hosts
const OURAIRPORTS_PRIMARY = "https://ourairports.com/airports.csv";
const OURAIRPORTS_FALLBACK =
  "https://davidmegginson.github.io/ourairports-data/airports.csv";

// AeroDataBox (RapidAPI) config
const AERODATABOX_BASE = "https://aerodatabox.p.rapidapi.com";
const AERODATABOX_KEY =
  process.env.REACT_APP_AERODATABOX_KEY ||
  "8da198473emsh9b4656b45d316fbp119aeejsn0f5084648752";
const AERODATABOX_HOST =
  process.env.REACT_APP_AERODATABOX_HOST || "aerodatabox.p.rapidapi.com";

/* -------------------------------------------------
   Generic helpers + proxy handling
   ------------------------------------------------- */

function shouldUseProxy() {
  if (!PROXY_BASE) return false;
  if (typeof window !== "undefined" && PROXY_BASE.startsWith("http")) {
    try {
      const pOrigin = new URL(PROXY_BASE).origin;
      const wOrigin = window.location.origin;
      if (pOrigin === wOrigin) {
        console.warn(
          `[flightsApi] Ignoring proxy because REACT_APP_API_PROXY (${PROXY_BASE}) points to same origin as frontend (${wOrigin}).`
        );
        return false;
      }
    } catch (err) {
      console.warn(
        "[flightsApi] Could not parse REACT_APP_API_PROXY; ignoring proxy.",
        err
      );
      return false;
    }
  }
  return !!PROXY_BASE;
}
const USE_PROXY = shouldUseProxy();

// Shared fetch helper (JSON)
async function safeFetchJson(url, opts = {}) {
  const res = await fetch(url, opts);
  const text = await res.text().catch(() => "");
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
  const cleanPath = path.startsWith("/") ? path : "/" + path;
  const qs = new URLSearchParams(params).toString();
  return `${PROXY_BASE}${cleanPath}${qs ? "?" + qs : ""}`;
}

/* -------------------------------------------------
   OurAirports CSV loader & helpers (IATA-only)
   ------------------------------------------------- */

let _ourAirportsLoaded = false;
let _ourAirportsList = [];
let _ourAirportsIndex = {
  byIata: new Map(),
  byCity: new Map(),
  byName: []
};

function splitCsvLine(line) {
  const parts = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  return parts.map((p) => {
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
      const url = buildProxyUrl("/ourairports/airports.csv");
      const res = await fetch(url, {
        method: "GET",
        headers: { Accept: "text/csv" }
      });
      if (!res.ok) throw new Error(`Proxy returned ${res.status}`);
      return await res.text();
    } catch (err) {
      console.warn(
        "fetchOurAirportsCsvText proxy failed, falling back to public hosts:",
        err
      );
    }
  }

  const candidates = [
    OURAIRPORTS_FALLBACK,
    "https://raw.githubusercontent.com/davidmegginson/ourairports-data/master/airports.csv",
    OURAIRPORTS_PRIMARY
  ];

  for (const u of candidates) {
    try {
      const res = await fetch(u, {
        method: "GET",
        headers: { Accept: "text/csv" }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${u}`);
      const text = await res.text();
      if (text && text.length > 100) return text;
      console.warn(
        `fetchOurAirportsCsvText: fetched ${u} but content too small`
      );
    } catch (err) {
      console.warn(`fetchOurAirportsCsvText: failed to fetch ${u}:`, err);
    }
  }

  throw new Error(
    "Could not fetch OurAirports CSV from proxy or public hosts (CORS, cert or network issue)."
  );
}

function normalizeHeaderKey(k) {
  return String(k || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

async function loadOurAirportsCsv(force = false) {
  if (_ourAirportsLoaded && !force) return _ourAirportsList;

  const txt = await fetchOurAirportsCsvText();
  const lines = txt.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines || lines.length < 2) {
    _ourAirportsLoaded = false;
    _ourAirportsList = [];
    throw new Error("OurAirports CSV appears empty or malformed");
  }

  const headerParts = splitCsvLine(lines.shift());
  const headers = headerParts.map(normalizeHeaderKey);

  const parsed = lines.map((line) => {
    const cols = splitCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = cols[i] !== undefined ? cols[i] : "";
    });
    return obj;
  });

  const filtered = parsed.filter((row) => {
    const iataCandidates = (row.iata_code || row.iata || "").trim();
    return !!iataCandidates && /^[A-Za-z0-9]{1,3}$/.test(iataCandidates);
  });

  _ourAirportsList = filtered;

  _ourAirportsIndex = { byIata: new Map(), byCity: new Map(), byName: [] };
  filtered.forEach((a) => {
    const iata = (a.iata || a.iata_code || "").toUpperCase();
    const city = (a.municipality || a.city || "").toLowerCase();
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

function mapOurAirportRowToResp(row) {
  const lat = parseFloat(row.latitude_deg || row.latitude || "") || null;
  const lon = parseFloat(row.longitude_deg || row.longitude || "") || null;
  const iata = (row.iata || row.iata_code || "").trim();
  const municipality = row.municipality || row.city || "";
  const country = row.iso_country || row.country || "";

  return {
    id: row.id || row.ident || `${iata || (row.name || "")}`.trim(),
    type: row.type || "airport",
    name: row.name || "",
    iata: iata,
    cityName: municipality || "",
    countryName: country || "",
    geoCode: lat && lon ? { latitude: lat, longitude: lon } : null,
    raw: row
  };
}

async function getAirportRowByIata(iataCode) {
  if (!iataCode) return null;
  try {
    await loadOurAirportsCsv();
  } catch (err) {
    console.error("getAirportRowByIata: failed to load CSV", err);
    return null;
  }
  return (
    _ourAirportsIndex.byIata.get(String(iataCode).toUpperCase()) || null
  );
}

/* -------------------------------------------------
   Airports public API (used by FlightFinder)
   ------------------------------------------------- */

export async function searchAirportsByCity(
  keywordOrObj,
  limit = 20,
  countryCode
) {
  let keyword = "";
  if (!keywordOrObj) return [];
  if (typeof keywordOrObj === "string") keyword = keywordOrObj;
  else if (typeof keywordOrObj === "object" && keywordOrObj.keyword)
    keyword = keywordOrObj.keyword;
  else keyword = String(keywordOrObj);

  keyword = keyword.replace(/[(),]/g, " ").replace(/\s+/g, " ").trim();
  if (!keyword || keyword.length < 1) return [];

  try {
    await loadOurAirportsCsv();
  } catch (err) {
    console.error(
      "searchAirportsByCity: failed to load OurAirports CSV:",
      err
    );
    return [];
  }

  const q = keyword.toLowerCase();

  if (q.length === 3) {
    const iata = q.toUpperCase();
    const row = _ourAirportsIndex.byIata.get(iata);
    if (row) {
      if (countryCode) {
        const ccUpper = String(countryCode).toUpperCase();
        if ((row.iso_country || "").toUpperCase() !== ccUpper) {
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
    const iata = ((row.iata || row.iata_code || "") + "").toLowerCase();
    const name = (row.name || "").toLowerCase();
    const city = (row.municipality || row.city || "").toLowerCase();
    const ident = (row.ident || row.local_code || "").toLowerCase();
    const country = (row.iso_country || row.country || "").toLowerCase();

    if (countryCode && String(countryCode || "").trim().length > 0) {
      const cc = String(countryCode).toLowerCase();
      if (
        !(
          country === cc ||
          (row.country &&
            String(row.country).toLowerCase().includes(cc))
        )
      ) {
        continue;
      }
    }

    if (
      iata.includes(q) ||
      name.includes(q) ||
      city.includes(q) ||
      ident.includes(q) ||
      (row.keywords || "").toLowerCase().includes(q)
    ) {
      results.push(mapOurAirportRowToResp(row));
    }
  }

  return results.slice(0, limit);
}

export async function getAirportsByCountry(
  countryCode,
  cityName = "",
  limit = 50
) {
  if (!countryCode) return [];

  try {
    await loadOurAirportsCsv();
  } catch (err) {
    console.error("getAirportsByCountry: failed to load OurAirports CSV:", err);
    return [];
  }

  const cc = String(countryCode).toUpperCase();
  const cityQ = String(cityName || "").toLowerCase().trim();
  const max = Math.max(5, Math.min(limit || 50, 1000));

  const out = [];
  for (const row of _ourAirportsList) {
    if (out.length >= max) break;
    const iso = (row.iso_country || row.country || "").toUpperCase();
    if (iso !== cc) continue;
    if (cityQ) {
      const city = (row.municipality || row.city || "").toLowerCase();
      if (!city.includes(cityQ)) continue;
    }
    out.push(mapOurAirportRowToResp(row));
  }

  return out;
}

export async function getAirportOptionsForSelect(
  keyword,
  limit = 20,
  countryCode,
  cityName
) {
  if (countryCode) {
    try {
      const items = await getAirportsByCountry(
        countryCode,
        cityName || keyword || "",
        limit
      );
      return items.map((a) => ({
        value: a.iata || a.id,
        label: `${a.iata ? a.iata + " — " : ""}${a.name || ""}${
          a.cityName
            ? ` (${a.cityName}${
                a.countryName ? ", " + a.countryName : ""
              })`
            : ""
        }`,
        meta: a
      }));
    } catch (err) {
      console.warn(
        "getAirportOptionsForSelect: getAirportsByCountry failed, falling back to search",
        err
      );
    }
  }

  const items = await searchAirportsByCity(keyword, limit, countryCode);
  return items.map((a) => ({
    value: a.iata || a.id,
    label: `${a.iata ? a.iata + " — " : ""}${a.name || ""}${
      a.cityName
        ? ` (${a.cityName}${a.countryName ? ", " + a.countryName : ""})`
        : ""
    }`,
    meta: a
  }));
}

/* -------------------------------------------------
   AeroDataBox flight search (RapidAPI)
   ------------------------------------------------- */

// Formato fecha -> YYYY-MM-DD
function fmtDate(d) {
  if (!d) return undefined;
  if (d instanceof Date) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  const s = String(d);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s;
}

async function callAeroDataBox(path, query = {}) {
  if (!AERODATABOX_KEY) {
    throw new Error(
      "Falta REACT_APP_AERODATABOX_KEY en tu .env para usar AeroDataBox (RapidAPI)."
    );
  }

  const url = new URL(AERODATABOX_BASE + path);
  Object.entries(query || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    url.searchParams.set(k, String(v));
  });

  return safeFetchJson(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-RapidAPI-Key": AERODATABOX_KEY,
      "X-RapidAPI-Host": AERODATABOX_HOST
    }
  });
}

/**
 * Helper: trae salidas en una ventana de tiempo (máx 12 horas).
 */
async function fetchDeparturesWindow(originIcao, fromIso, toIso) {
  const json = await callAeroDataBox(
    `/flights/airports/icao/${encodeURIComponent(originIcao)}/${fromIso}/${toIso}`,
    {
      direction: "Departure",
      withLocation: "false",
      withAircraftImage: "false"
    }
  );

  return Array.isArray(json?.departures) ? json.departures : [];
}

/**
 * Buscar vuelos por ruta (usado para "availableFlights").
 * Implementado con AeroDataBox:
 *  - Resuelve IATA -> ICAO con OurAirports
 *  - Llama dos veces a /flights/airports/icao/... en ventanas de 12h
 *    (00:00–11:59 y 12:00–23:59) para respetar el límite de 12 horas.
 *  - Filtra por aeropuerto destino.
 *
 * Devuelve { data: [ flights[] ] }.
 */
export async function searchFlights({
  originLocationCode,
  destinationLocationCode,
  departureDate
} = {}) {
  if (!originLocationCode || !destinationLocationCode || !departureDate) {
    throw new Error(
      "originLocationCode, destinationLocationCode y departureDate son requeridos"
    );
  }

  const originRow = await getAirportRowByIata(originLocationCode);
  if (!originRow) {
    console.warn(
      "[searchFlights] No pude resolver ICAO para origen",
      originLocationCode
    );
    return { data: [] };
  }

  const originIcao =
    (originRow.ident || originRow.gps_code || "").toUpperCase();
  if (!originIcao) {
    console.warn(
      "[searchFlights] Origen sin ICAO en OurAirports",
      originLocationCode,
      originRow
    );
    return { data: [] };
  }

  const dateStr = fmtDate(departureDate);

  // Dos ventanas de <= 12h para evitar el error de la API
  const fromIso1 = `${dateStr}T00:00`;
  const toIso1 = `${dateStr}T11:59`;
  const fromIso2 = `${dateStr}T12:00`;
  const toIso2 = `${dateStr}T23:59`;

  // 👉 Sequential calls instead of Promise.all to be nicer with rate limits
  const deps1 = await fetchDeparturesWindow(originIcao, fromIso1, toIso1);
  const deps2 = await fetchDeparturesWindow(originIcao, fromIso2, toIso2);

  const departures = [...deps1, ...deps2];

  const destIataUpper = String(destinationLocationCode).toUpperCase();

  const flights = departures.filter((f) => {
    const arrAirport = f?.movement?.airport || {};
    const arrIata =
      (arrAirport.iata ||
        arrAirport.iataCode ||
        arrAirport.iata_code ||
        "") + "";
    return arrIata.toUpperCase() === destIataUpper;
  });

  return { data: flights };
}

/**
 * Buscar vuelo por código IATA (ej: "AA123") y opcional fecha.
 * Usa /flights/number/{flightNumber}/{date}.
 * Devuelve un array de vuelos raw de AeroDataBox.
 */
export async function searchFlightByCode(flightCode, flightDate) {
  if (!flightCode) return [];
  const cleanCode = String(flightCode).replace(/\s+/g, "").toUpperCase();
  const dateStr = fmtDate(flightDate) || fmtDate(new Date());

  const json = await callAeroDataBox(
    `/flights/number/${encodeURIComponent(cleanCode)}/${encodeURIComponent(
      dateStr
    )}`,
    {
      withLocation: "false",
      withAircraftImage: "false"
    }
  );

  // La API puede devolver directamente un array o un objeto con alguna propiedad tipo data/flights
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.flights)) return json.flights;
  if (Array.isArray(json?.data)) return json.data;
  return [];
}

/**
 * getOfferById: reconstruye datos a partir de tu flight_id tipo "AA123|2024-05-10"
 * Rebusca el vuelo en AeroDataBox.
 */
export async function getOfferById(flightId) {
  if (!flightId) return null;
  const fid = String(flightId).trim();

  let codeMatch = fid.match(/^([A-Za-z]{2,3}\d{1,4})/);
  if (!codeMatch) {
    codeMatch = fid.match(/([A-Za-z]{2,3}\d{1,4})/);
  }
  if (!codeMatch) return null;
  const code = codeMatch[1].toUpperCase();

  const dateMatch = fid.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  const date = dateMatch ? dateMatch[1] : undefined;

  const flights = await searchFlightByCode(code, date);
  if (!flights || flights.length === 0) return null;
  return flights[0];
}

const flightsApi = {
  searchAirportsByCity,
  getAirportOptionsForSelect,
  getAirportsByCountry,
  searchFlights,
  searchFlightByCode,
  getOfferById
};

export default flightsApi;
