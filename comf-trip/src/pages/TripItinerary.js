// src/pages/TripItinerary.jsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Map, {
  Marker,
  NavigationControl,
  Popup,
  Source,
  Layer,
} from "react-map-gl/mapbox";
import "../styles/tripItinerary.css";
import Header from "../components/Header";
import "../styles/header.css";
import Select from "react-select";
import { apiDelete, apiGet, apiPost, apiPut } from "./api";
import flightsApi from "../services/flightsApi";
import { Country, City } from "country-state-city";

const MAPBOX_TOKEN =
  process.env.REACT_APP_MAPBOX_TOKEN ||
  "pk.eyJ1IjoibWFuZHJhY2EiLCJhIjoiY21mZnE1dmI0MDlubjJpcG5rYmw3ZnRiZiJ9.RwdRSwXlP1PX_7j7cwUsMA";

export default function TripItinerary() {
  const params = useParams();
  const navigate = useNavigate();
  const tripIdRaw = params.tripId ?? params.id ?? params?.tripId;
  const tripId = Number(tripIdRaw);

  // loading / trip state
  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState(null);
  const [clickOnMap, setClickOnMap] = useState(false);

  // map state
  const [viewState, setViewState] = useState({
    latitude: -34.6037,
    longitude: -58.3816,
    zoom: 11,
  });

  // selected location shown in right popup / detail
  // shape: { latitude, longitude, place, titulo, image, imageUrl, loadImage, imageLoading }
  const [selectedLocationOnMap, setSelectedLocationOnMap] = useState(null);

  // day route state
  const [activeRouteDateKey, setActiveRouteDateKey] = useState(null);
  const [dayRouteGeoJSON, setDayRouteGeoJSON] = useState(null);
  const [dayRoutePoints, setDayRoutePoints] = useState([]); // for numbered markers

  // menu state for place items
  const [menuOpen, setMenuOpen] = useState(null); // stores place id when open
  const menuContainerRef = useRef(null);

  // flight/backend state (keeps AddTrip-like card)
  const [backendFlight, setBackendFlight] = useState(null);
  const [loadingFlight, setLoadingFlight] = useState(false);
  const [flightMessage, setFlightMessage] = useState(null);

  // AddTrip-like controls
  const [originCountryIso, setOriginCountryIso] = useState(null);
  const [originCityOptions, setOriginCityOptions] = useState([]);
  const [originCityValue, setOriginCityValue] = useState(null);
  const [originAirportOptions, setOriginAirportOptions] = useState([]);
  const [originAirportValue, setOriginAirportValue] = useState(null);
  const [destinationAirportOptions, setDestinationAirportOptions] = useState(
    []
  );
  const [destinationAirportValue, setDestinationAirportValue] = useState(null);
  const [flightOffers, setFlightOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [selectedFlightOption, setSelectedFlightOption] = useState(null);

  // enriched backend flight info (from flightsApi)
  const [backendFlightDetails, setBackendFlightDetails] = useState(null);

  // helper: map a flight-offer / raw offer into the react-select option shape used in this file
// helper: map a flight-offer / raw offer into the react-select option shape used in this file
const mapOfferToSelectOption = (offer, idx = 0) => {
  if (!offer) return null;
  const itinerary = Array.isArray(offer.itineraries) && offer.itineraries[0];
  const segments =
    itinerary && Array.isArray(itinerary.segments) ? itinerary.segments : [];
  const firstSeg = segments[0] || {};
  const lastSeg = segments[segments.length - 1] || firstSeg || {};
  const dep = firstSeg?.departure?.at || firstSeg?.departure?.iataCode || "";
  const arr = lastSeg?.arrival?.at || lastSeg?.arrival?.iataCode || "";
  const times =
    dep && arr
      ? `${(String(dep).split("T")[1] || dep).slice(0, 5)} → ${(
          String(arr).split("T")[1] || arr
        ).slice(0, 5)}`
      : "";
  const carrier = firstSeg?.carrierCode || firstSeg?.carrier || "";
  const number = firstSeg?.number || offer.flight?.number || "";
  const flightCode = (carrier || "") + (number ? String(number) : "");
  const airline =
    firstSeg?.operating?.carrierName ||
    firstSeg?.carrierName ||
    offer?.raw?.carrierName ||
    "";
  const duration =
    itinerary && itinerary.duration ? itinerary.duration : firstSeg?.duration || "";
  const price = offer?.price?.total
    ? `${offer.price.total} ${offer.price.currency || ""}`
    : offer?.meta?.price || "";

  // prefer flightCode as the canonical value when available (e.g. "KL1512")
  const canonicalId = flightCode || offer?.id || offer?.raw?.id || `offer_${idx}`;

  return {
    value: canonicalId,
    label: `${flightCode ? flightCode + "" : ""}${
      airline || offer.label || ""
    }${price ? ` · ${price}` : ""}`,
    meta: { times, flightCode, airline, duration, price },
    raw: offer,
  };
};


  // ---- locations picker (only for the trip's city) ----
  const [locationsOptions, setLocationsOptions] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [selectedLocationOption, setSelectedLocationOption] = useState(null);
  const [addingLocation, setAddingLocation] = useState(false);
  const [addLocationMessage, setAddLocationMessage] = useState(null);

  // loading flags for airports
  const [destinationAirportsLoading, setDestinationAirportsLoading] =
    useState(false);
  const [originAirportsLoading, setOriginAirportsLoading] = useState(false);

  // Primary color handling (read from CSS var --primary-color or fallback to old blue)
  // We'll compute a lighter tint and an RGB object for rgba shadows
  const [primaryColor, setPrimaryColor] = useState("#FF7485"); // fallback
  const [primaryLight, setPrimaryLight] = useState("#FF7485"); // default will be overwritten by effect
  const [primaryRgb, setPrimaryRgb] = useState({ r: 25, g: 120, b: 200 });

  // helpers to compute lighter color & rgb
  const hexToRgb = (hex) => {
    if (!hex) return { r: 25, g: 120, b: 200 };
    let h = String(hex).replace("#", "").trim();
    if (h.length === 3)
      h = h
        .split("")
        .map((c) => c + c)
        .join("");
    if (h.length !== 6) return { r: 25, g: 120, b: 200 };
    const num = parseInt(h, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  };
  const lightenHex = (hex, percent) => {
    const rgb = hexToRgb(hex);
    const r = Math.round(rgb.r + (255 - rgb.r) * percent);
    const g = Math.round(rgb.g + (255 - rgb.g) * percent);
    const b = Math.round(rgb.b + (255 - rgb.b) * percent);
    const toHex = (v) => v.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  useEffect(() => {
    // read primary color from CSS var if set
    try {
      const cssVal =
        getComputedStyle(document.documentElement).getPropertyValue(
          "--primary-color"
        ) || "";
      const prim = cssVal.trim() || "#FF7485";
      const light = lightenHex(prim, 0.28); // 28% closer to white => lighter variant
      setPrimaryColor(prim);
      setPrimaryLight(light);
      setPrimaryRgb(hexToRgb(light));
    } catch (e) {
      // ignore, keep defaults
      setPrimaryColor("#FF7485");
      setPrimaryLight("#FF7485");
      setPrimaryRgb({ r: 25, g: 120, b: 200 });
    }
  }, []);

  // small fallback map for a few countries (keeps compatibility with older labels)
  const FALLBACK_NAME_TO_ISO = {
    Spain: "ES",
    Argentina: "AR",
    Italy: "IT",
    Germany: "DE",
    France: "FR",
  };

  // try to resolve an ISO2 code from a country name using country-state-city data, fallback to small map
  const getIsoFromCountryName = (countryName) => {
    if (!countryName) return undefined;
    try {
      const all = Country.getAllCountries() || [];
      const found = all.find((c) => {
        if (!c || !c.name) return false;
        return c.name.toLowerCase() === String(countryName).toLowerCase();
      });
      if (found && found.isoCode) return found.isoCode;
    } catch (e) {
      // ignore
    }
    if (FALLBACK_NAME_TO_ISO[countryName])
      return FALLBACK_NAME_TO_ISO[countryName];
    return undefined;
  };

  const countryIntlDisplay = useMemo(() => {
    try {
      return new Intl.DisplayNames(["es"], { type: "region" });
    } catch (e) {
      return null;
    }
  }, []);

  const countryOptions = useMemo(() => {
    const all = Country.getAllCountries() || [];
    return all
      .map((c) => {
        const iso = c.isoCode;
        let label;
        try {
          label = countryIntlDisplay ? countryIntlDisplay.of(iso) : c.name;
        } catch (e) {
          label = c.name;
        }
        return { value: iso, label };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
  }, [countryIntlDisplay]);

  const fmtDate = (d) => {
    if (!d) return "-";
    if (d instanceof Date) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yy = d.getFullYear();
      return `${dd}/${mm}/${yy}`;
    }
    const parts = String(d).split("T")[0].split("-");
    if (parts.length !== 3) return d;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // trip start ISO for flight searches
  const tripStartIso = useMemo(
    () => (trip?.start_date ? String(trip.start_date).split("T")[0] : null),
    [trip]
  );

  // load trip
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!Number.isFinite(tripId) || tripId <= 0) {
        setError("ID de viaje inválido en la URL.");
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const tripRes = await apiGet(`/trips/${tripId}`);
        if (!mounted) return;
        // provide default image if none for first place (non-blocking)
        if (
          tripRes.places &&
          tripRes.places.length &&
          !(tripRes.places[0].images && tripRes.places[0].images.length)
        ) {
          tripRes.places[0].images = [
            "https://i.pinimg.com/originals/d8/5d/9a/d85d9a3c01e81a917af38532b6b7523c.jpg",
          ];
        }
        setTrip(tripRes);

        const firstWithCoords = (tripRes.places || []).find((p) => {
          const loc = p.location || {};
          return (
            (loc.latitude !== undefined || loc.latitud !== undefined) &&
            (loc.longitude !== undefined || loc.longitud !== undefined)
          );
        });
        if (firstWithCoords) {
          const loc = firstWithCoords.location || {};
          const lat = Number(loc.latitude ?? loc.latitud);
          const lng = Number(loc.longitude ?? loc.longitud);
          setClickOnMap(true);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            setViewState({ latitude: lat, longitude: lng, zoom: 12 });
          }
        }

try {
  // ask backend which flights are associated with this trip for the authenticated user
  const flightsList = await apiGet(
    `/flights?trip_id=${encodeURIComponent(tripId)}`
  ).catch(() => null);

  const first = flightsList && Array.isArray(flightsList.flights) && flightsList.flights.length
    ? flightsList.flights[0]
    : null;

  if (first) {
    // backend flight record from your API: { flight_id, user_id, trip_id, created_at }
    setBackendFlight(first);

    // enrich using flightsApi (external/third-party data) if available
    if (typeof flightsApi.getOfferById === "function") {
      try {
        const rawOffer = await flightsApi.getOfferById(String(first.flight_id));
        if (rawOffer) {
          const mapped = mapOfferToSelectOption(rawOffer);
          setBackendFlightDetails(mapped);
          setSelectedFlightOption(mapped);
        } else {
          setBackendFlightDetails(null);
        }
      } catch (err) {
        console.warn("flightsApi.getOfferById failed", err);
        setBackendFlightDetails(null);
      }
    } else {
      setBackendFlightDetails(null);
    }
  } else {
    setBackendFlight(null);
    setBackendFlightDetails(null);
  }
} catch (err) {
  console.warn("Error checking flights for trip:", err);
  setBackendFlight(null);
  setBackendFlightDetails(null);
}


        // attempt to pre-fill destination airports (parse trip.destination "City, Country" if present)
        try {
          const dest = tripRes.destination || "";
          if (dest) {
            // try to parse "City, Country" patterns
            const parsed = parseCityCountryFromString(dest);
            const city = parsed.cityName || dest;
            const country = parsed.countryName || "";
            const iso = getIsoFromCountryName(country);
            // fetch destination airports using iso when available
            // NOTE: do NOT await here — we want the page to render immediately and let airports load in background
            fetchDestinationAirports(city || dest, 200, iso);
          }
        } catch (e) {
          // ignore non-fatal
          console.warn("preload dest airports failed", e);
        }
      } catch (err) {
        console.error("TripItinerary load error:", err);
        setError("No se pudo cargar el viaje.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [tripId]);

  // parse helper: "Barcelona, Spain" => { cityName: 'Barcelona', countryName: 'Spain' }
  const parseCityCountryFromString = (str) => {
    if (!str || typeof str !== "string")
      return { cityName: "", countryName: "" };
    const parts = str
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      return {
        cityName: parts.slice(0, parts.length - 1).join(", "),
        countryName: parts[parts.length - 1],
      };
    }
    return { cityName: parts[0] || "", countryName: "" };
  };

  const displayTripDestination = useMemo(() => {
    if (!trip || !trip.destination) return "";
    const parsed = parseCityCountryFromString(trip.destination || "");
    const city = parsed.cityName || "";
    const country = parsed.countryName || "";
    const iso = getIsoFromCountryName(country);
    let countryLabel = country || "";
    try {
      if (iso && countryIntlDisplay) {
        countryLabel = countryIntlDisplay.of(iso) || country;
      }
    } catch (e) {
      countryLabel = country;
    }
    return city
      ? city + (countryLabel ? `, ${countryLabel}` : "")
      : trip.destination;
  }, [trip, countryIntlDisplay]);

  // origin city autocomplete
  const fetchOriginCityOptions = (input) => {
    const q = typeof input === "string" ? input.trim() : String(input || "");
    if (!q || q.length < 2) {
      setOriginCityOptions([]);
      return;
    }
    if (!originCountryIso) {
      setOriginCityOptions([]);
      return;
    }
    const found = Country.getAllCountries().find(
      (c) => c.isoCode === originCountryIso
    );
    if (!found) {
      setOriginCityOptions([]);
      return;
    }
    let cities = [];
    try {
      cities = City.getCitiesOfCountry(found.isoCode) || [];
    } catch (e) {
      cities = [];
    }
    const out = [];
    const seen = new Set();
    for (let i = 0; i < cities.length && out.length < 100; i++) {
      const c = cities[i];
      if (!c || !c.name) continue;
      if (c.name.toLowerCase().includes(q.toLowerCase())) {
        const key = `${c.name}|||${found.isoCode}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({
            value: key,
            label: `${c.name}, ${countryIntlDisplay
              ? countryIntlDisplay.of(found.isoCode)
              : found.name
              }`,
            meta: { cityName: c.name, countryName: found.name },
          });
        }
      }
    }
    setOriginCityOptions(out);
  };

  // helper to normalize & filter airports (only keep IATA entries)
  const mapAndFilterAirportResults = (items) => {
    if (!Array.isArray(items)) return [];
    return items
      .map((a) => {
        const meta = a.meta || a.raw || {};
        const iata =
          a.value && typeof a.value === "string" && a.value.length === 3
            ? a.value
            : meta.iata || meta.iata_code || "";
        const val = iata || a.value || meta.id || "";
        const label =
          a.label || (iata ? `${iata} — ${meta.name || ""}` : meta.name || val);
        return { value: val, label, meta: { ...meta, iata } };
      })
      .filter(
        (x) => x.meta && x.meta.iata && String(x.meta.iata).trim().length === 3
      );
  };

  // fetch origin airports (uses originCountryIso)
  const fetchOriginAirports = async (cityOrKeyword, limit = 200) => {
    setOriginAirportsLoading(true);
    try {
      const res = await flightsApi.getAirportOptionsForSelect(
        cityOrKeyword || "",
        limit,
        originCountryIso || undefined,
        cityOrKeyword || ""
      );
      setOriginAirportOptions(mapAndFilterAirportResults(res || []));
    } catch (err) {
      console.error("fetchOriginAirports", err);
      setOriginAirportOptions([]);
    } finally {
      setOriginAirportsLoading(false);
    }
  };

  // fetch destination airports: accepts optional countryCode (ISO2)
  const fetchDestinationAirports = async (
    keywordOrCity,
    limit = 200,
    countryCode
  ) => {
    setDestinationAirportsLoading(true);
    try {
      const res = await flightsApi.getAirportOptionsForSelect(
        keywordOrCity || "",
        limit,
        countryCode || undefined,
        keywordOrCity || ""
      );
      setDestinationAirportOptions(mapAndFilterAirportResults(res || []));
    } catch (err) {
      console.error("fetchDestinationAirports", err);
      setDestinationAirportOptions([]);
    } finally {
      setDestinationAirportsLoading(false);
    }
  };

  /**
   * Fetch locations by country and filter to the trip city.
   * IMPORTANT: this version removes any locations that are already present
   * in the current trip (so the select never shows duplicates).
   *
   * countryQuery: string (sent to ?country=...)
   * cityName: string (optional) - will filter client-side to the trip city
   */
  const fetchLocationsForCountry = async (countryQuery, cityName = "") => {
    if (!countryQuery) {
      setLocationsOptions([]);
      return;
    }
    setLocationsLoading(true);
    try {
      const res = await apiGet(
        `/locations?country=${encodeURIComponent(countryQuery)}&limit=500`
      );
      const rows = Array.isArray(res) ? res : [];

      // Normalize fields (support english/spanish variations)
      const normalized = rows
        .map((r) => ({
          id: Number(r.id ?? r.ID ?? r.id),
          title: String(
            r.title ?? r.titulo ?? r.descripcion ?? r.description ?? ""
          ).trim(),
          city: String(r.city ?? r.city_name ?? "").trim(),
          country: String(r.country ?? r.country_name ?? "").trim(),
          latitude: r.latitude ?? r.latitud ?? r.lat,
          longitude: r.longitude ?? r.longitud ?? r.lng,
          images: r.images ?? r.imagenes ?? [],
        }))
        .filter((x) => Number.isFinite(x.id));

      // Build set of existing location IDs from trip.places to exclude duplicates.
      const existingIds = new Set(
        (trip?.places || [])
          .map((p) => {
            return Number(
              p.fk_location ??
              p.fk_locations ??
              p.location?.id ??
              p.location?.fk_location ??
              NaN
            );
          })
          .filter(Number.isFinite)
      );

      // Filter by cityName if provided (case-insensitive partial match), then exclude existing IDs.
      const filtered = normalized.filter((item) => {
        if (cityName) {
          if (!item.city) return false;
          if (
            !String(item.city)
              .toLowerCase()
              .includes(String(cityName).toLowerCase())
          )
            return false;
        }
        // Exclude if this location id is already in the trip
        return !existingIds.has(Number(item.id));
      });

      const opts = filtered.map((r) => ({
        value: Number(r.id),
        label: `${r.title || "Sin título"}${r.city ? ` — ${r.city}` : ""}`,
        meta: r,
      }));

      setLocationsOptions(opts);
    } catch (err) {
      console.error("fetchLocationsForCountry", err);
      setLocationsOptions([]);
    } finally {
      setLocationsLoading(false);
    }
  };

  // reset origin dependent fields on country change
  useEffect(() => {
    setOriginCityValue(null);
    setOriginCityOptions([]);
    setOriginAirportValue(null);
    setOriginAirportOptions([]);
  }, [originCountryIso]);

  // when origin city chosen -> load its airports
  useEffect(() => {
    if (!originCityValue) {
      setOriginAirportOptions([]);
      return;
    }
    const cityName =
      originCityValue.meta?.cityName ||
      originCityValue.label ||
      String(originCityValue.value || "");
    fetchOriginAirports(cityName);
  }, [originCityValue]);

  // when trip loaded, we already attempted to populate destination airports in the trip loader effect
  // but also react to manual trip.destination changes if any
  useEffect(() => {
    if (!trip) return;
    const destCityRaw = trip.destination || "";
    if (!destCityRaw) return;
    const parsed = parseCityCountryFromString(destCityRaw);
    const city = parsed.cityName || destCityRaw;
    const country = parsed.countryName || "";
    const iso = getIsoFromCountryName(country);
    fetchDestinationAirports(city || destCityRaw, 200, iso);
  }, [trip]);

  // auto-fetch flight offers when originAirport + destinationAirport + tripStartIso available
  useEffect(() => {
    let mounted = true;
    const originCode =
      originAirportValue?.value || originAirportValue?.meta?.iata || null;
    const destCode =
      destinationAirportValue?.value ||
      destinationAirportValue?.meta?.iata ||
      null;
    const date = tripStartIso || null;

    if (!originCode || !destCode || !date) {
      setFlightOffers([]);
      setSelectedFlightOption(null);
      setOffersLoading(false);
      return;
    }

    (async () => {
      setOffersLoading(true);
      setFlightOffers([]);
      setSelectedFlightOption(null);
      try {
        const res = await flightsApi.searchFlights({
          originLocationCode: originCode,
          destinationLocationCode: destCode,
          departureDate: date,
          adults: 1,
          max: 12,
          travelClass: "ECONOMY",
        });

        if (!mounted) return;
        const rawOffers = res?.data || res?.results || res || [];
        const mapped = (rawOffers || []).map((offer, i) => {
          const itinerary =
            Array.isArray(offer.itineraries) && offer.itineraries[0];
          const segments =
            itinerary && Array.isArray(itinerary.segments)
              ? itinerary.segments
              : [];
          const firstSeg = segments[0] || {};
          const lastSeg = segments[segments.length - 1] || firstSeg || {};
          const dep =
            firstSeg?.departure?.at || firstSeg?.departure?.iataCode || "";
          const arr = lastSeg?.arrival?.at || lastSeg?.arrival?.iataCode || "";
          const times =
            dep && arr
              ? `${(String(dep).split("T")[1] || dep).slice(0, 5)} → ${(
                String(arr).split("T")[1] || arr
              ).slice(0, 5)}`
              : "";
          const carrier =
            firstSeg?.carrierCode ||
            firstSeg?.carrier ||
            (offer.flight?.iataNumber
              ? offer.flight.iataNumber.replace(/\d+/g, "")
              : "");
          const number = firstSeg?.number || offer.flight?.number || "";
          const flightCode = (carrier || "") + (number ? String(number) : "");
          const airline =
            offer?.raw?.airline?.name || firstSeg?.carrierName || "";
          const duration =
            itinerary && itinerary.duration
              ? itinerary.duration
              : firstSeg?.duration || "";
          return {
            value: offer?.id || offer?.raw?.id || `offer_${i}`,
            label: `${flightCode ? flightCode + " · " : ""}${airline || offer.label || ""
              }`,
            meta: { times, flightCode, airline, duration },
            raw: offer,
          };
        });
        setFlightOffers(mapped);
      } catch (err) {
        console.error("auto-fetch flight offers error", err);
        setFlightOffers([]);
      } finally {
        if (mounted) setOffersLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originAirportValue, destinationAirportValue, tripStartIso]);

// persist selected flight (POST /flights, fallback to PUT/associate)
const handleSaveSelectedFlight = async () => {
  const selected = selectedFlightOption;
  const flightIdRaw = selected?.value || selected?.raw?.id || "";
  if (!selected) {
    setFlightMessage("Seleccioná un vuelo primero.");
    return;
  }
  setFlightMessage(null);
  setLoadingFlight(true);

  // derive carrier/number from meta.flightCode if present
  const flightCode = selected?.meta?.flightCode || ""; // e.g. "KL1512"
  let carrier = "";
  let number = "";
  const m = String(flightCode || "").trim().match(/^([A-Za-z]{2,3})(\d{1,4})([A-Za-z]?)$/);
  if (m) {
    carrier = m[1].toUpperCase();
    number = m[2];
  } else {
    // fallback: try to parse from raw offer if available
    carrier = selected?.raw?.carrierCode || selected?.raw?.flight?.carrier || "";
    number = selected?.raw?.flight?.number || selected?.raw?.flightNumber || "";
  }

  // scheduled date: prefer tripStartIso (you already compute it above)
  const scheduledDepartureDate = tripStartIso || new Date().toISOString().slice(0, 10);

  // canonical flight_id format: "CARRIER|NUMBER|YYYY-MM-DD"
  // this makes it easy for getOfferById to call /schedule/flights
  const canonicalFlightId = carrier && number ? `${carrier}|${number}|${scheduledDepartureDate}` : String(flightIdRaw);

  // price and raw offer (store them client-side to show price immediately; backend should persist if possible)
  const price = selected?.meta?.price || null;
  const rawOffer = selected?.raw || null;

  try {
    // create (or request backend associate)
    await apiPost("/flights", {
      flight_id: String(canonicalFlightId),
      trip_id: tripId,
      // optional helpful fields your backend can store/use
      carrier_code: carrier || undefined,
      flight_number: number || undefined,
      scheduled_departure_date: scheduledDepartureDate,
      price: price,
      raw_offer: rawOffer,
    });

    // refresh trip and backend flight record associated to this trip
    const freshTrip = await apiGet(`/trips/${tripId}`).catch(() => null);
    if (freshTrip) setTrip(freshTrip);

    // canonical: ask backend which flight is associated to this trip
    const flightsList = await apiGet(
      `/flights?trip_id=${encodeURIComponent(tripId)}`
    ).catch(() => null);

    const first = flightsList && Array.isArray(flightsList.flights) && flightsList.flights.length
      ? flightsList.flights[0]
      : null;

    if (first) {
      setBackendFlight(first);

      // enrich via flightsApi (now supports schedule lookup when flight_id is "C|N|YYYY-MM-DD")
      if (typeof flightsApi.getOfferById === "function") {
        try {
          const rawOfferFromApi = await flightsApi.getOfferById(String(first.flight_id));
          if (rawOfferFromApi) {
            const mapped = mapOfferToSelectOption(rawOfferFromApi);
            setBackendFlightDetails(mapped);
            setSelectedFlightOption(mapped);
          } else {
            // fallback: if backend returned raw_offer/price in the record, use that to show price immediately
            if (first.raw_offer) {
              const mapped = mapOfferToSelectOption(first.raw_offer);
              setBackendFlightDetails(mapped || { label: `${first.carrier_code || ""}${first.flight_number ? " " + first.flight_number : ""}`, meta: { price: first.price || "" }, raw: first.raw_offer });
              setSelectedFlightOption(mapped);
            } else {
              setBackendFlightDetails(null);
            }
          }
        } catch (err) {
          console.warn("Could not enrich backend flight via flightsApi.getOfferById", err);
          // use backend-stored raw_offer if available
          if (first.raw_offer) {
            const mapped = mapOfferToSelectOption(first.raw_offer);
            setBackendFlightDetails(mapped);
            setSelectedFlightOption(mapped);
          } else {
            setBackendFlightDetails(null);
          }
        }
      } else {
        setBackendFlightDetails(null);
      }
    } else {
      // fallback minimal state if backend did not return flights for this trip
      setBackendFlight({ flight_id: String(canonicalFlightId), created_at: null, raw_offer: rawOffer, price });
      setBackendFlightDetails(null);
    }

    setFlightMessage("Vuelo guardado y asociado al viaje.");
  } catch (err) {
    const status =
      err &&
      (err.status ||
        (err.body && err.body.status) ||
        (err.response && err.response.status));
    if (status === 409 || (err && String(err.message || "").includes("409"))) {
      // If already exists, attempt to associate via PUT then re-query (keep same logic you had)
      try {
        await apiPut(`/flights/${encodeURIComponent(String(canonicalFlightId))}`, {
          trip_id: tripId,
        });

        const freshTrip = await apiGet(`/trips/${tripId}`).catch(() => null);
        if (freshTrip) setTrip(freshTrip);

        const flightsList = await apiGet(
          `/flights?trip_id=${encodeURIComponent(tripId)}`
        ).catch(() => null);

        const first = flightsList && Array.isArray(flightsList.flights) && flightsList.flights.length
          ? flightsList.flights[0]
          : null;

        if (first) {
          setBackendFlight(first);
          if (typeof flightsApi.getOfferById === "function") {
            try {
              const rawOfferFromApi = await flightsApi.getOfferById(String(first.flight_id));
              if (rawOfferFromApi) {
                const mapped = mapOfferToSelectOption(rawOfferFromApi);
                setBackendFlightDetails(mapped);
                setSelectedFlightOption(mapped);
              } else {
                if (first.raw_offer) {
                  const mapped = mapOfferToSelectOption(first.raw_offer);
                  setBackendFlightDetails(mapped);
                  setSelectedFlightOption(mapped);
                } else {
                  setBackendFlightDetails(null);
                }
              }
            } catch (err2) {
              console.warn("Could not enrich backend flight after PUT", err2);
              setBackendFlightDetails(null);
            }
          } else {
            setBackendFlightDetails(null);
          }
        } else {
          setBackendFlight({ flight_id: String(canonicalFlightId), created_at: null });
          setBackendFlightDetails(null);
        }

        setFlightMessage("Vuelo existente asociado al viaje.");
      } catch (uerr) {
        console.warn("associate put failed", uerr);
        setFlightMessage("No se pudo asociar el vuelo existente.");
      }
    } else {
      console.error("save flight error", err);
      setFlightMessage("Error guardando vuelo. Revisa la consola.");
    }
  } finally {
    setLoadingFlight(false);
    window.setTimeout(() => setFlightMessage(null), 3500);
  }
};


  const handleAddLocationToItinerary = async () => {
    if (!selectedLocationOption) {
      setAddLocationMessage("Seleccioná un lugar primero.");
      return;
    }
    // Use trip.start_date as the insertion date (YYYY-MM-DD). Fallback to today.
    const dateOnly = trip?.start_date
      ? String(trip.start_date).split("T")[0]
      : new Date().toISOString().slice(0, 10);

    setAddingLocation(true);
    setAddLocationMessage(null);
    try {
      const payload = {
        place: {
          fk_location: Number(selectedLocationOption.value),
          date: dateOnly,
          // optional: you could add start_hour / end_hour / notes here
        },
      };
      await apiPost(`/trips/${tripId}/places/auto`, payload);
      // refresh trip contents after insertion
      const fresh = await apiGet(`/trips/${tripId}`);
      setTrip(fresh);
      setSelectedLocationOption(null);
      setAddLocationMessage(
        "Lugar agregado y reordenado en el día inicial del viaje."
      );
    } catch (err) {
      console.error("handleAddLocationToItinerary", err);
      const msg =
        err && (err.message || (err.body && err.body.message))
          ? err.message || err.body.message
          : "Error al agregar lugar";
      setAddLocationMessage(String(msg));
    } finally {
      setAddingLocation(false);
      window.setTimeout(() => setAddLocationMessage(null), 3500);
    }
  };

  const handleRemoveFlight = async () => {
    const fid = backendFlight?.flight_id || backendFlight?.flightId;
    if (!fid) return;
    if (!window.confirm("Quitar la asociación del vuelo con este viaje?"))
      return;
    try {
      await apiPut(`/flights/${encodeURIComponent(String(fid))}`, {
        trip_id: null,
      });
      setFlightMessage("Vuelo desasociado.");
      setBackendFlight(null);
      const fresh = await apiGet(`/trips/${tripId}`);
      setTrip(fresh);
    } catch (err) {
      console.error("disassociate error", err);
      setFlightMessage("Error al desasociar vuelo.");
    }
  };

  // handle outside click to close any open menu
  useEffect(() => {
    const onDocClick = () => setMenuOpen(null);
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // handler to open/toggle place menu
  const togglePlaceMenu = (ev, placeId) => {
    ev.stopPropagation(); // prevent parent handlers from firing
    setMenuOpen((prev) => (prev === placeId ? null : placeId));
  };

  // Re-filter current locationsOptions whenever trip.places changes (remove any that became duplicates)
  useEffect(() => {
    if (!Array.isArray(locationsOptions) || locationsOptions.length === 0)
      return;
    const existingIds = new Set(
      (trip?.places || [])
        .map((p) =>
          Number(p.fk_location ?? p.fk_locations ?? p.location?.id ?? NaN)
        )
        .filter(Number.isFinite)
    );
    // Only update if there are items to drop
    const filtered = locationsOptions.filter(
      (opt) => !existingIds.has(Number(opt.value))
    );
    if (filtered.length !== locationsOptions.length) {
      setLocationsOptions(filtered);
      // if selected option is now removed, clear selection
      if (
        selectedLocationOption &&
        existingIds.has(Number(selectedLocationOption.value))
      ) {
        setSelectedLocationOption(null);
      }
    }
  }, [trip?.places]); // run whenever trip.places changes

  // when trip loads, set a sensible default date for auto-add (use first day in grouped keys or trip.start_date)
  useEffect(() => {
    if (!trip) return;

    // detect country & city from trip.destination ("City, Country")
    const dest = trip.destination || "";
    const parsed = parseCityCountryFromString(dest);
    const city = parsed.cityName || ""; // e.g. "Rome"
    const country = parsed.countryName || dest || ""; // e.g. "Italy" or fallback to whole dest

    // fetch locations for this country but filter client-side to the trip city
    if (country) {
      fetchLocationsForCountry(country, city);
    } else if (dest) {
      fetchLocationsForCountry(dest, city);
    } else {
      setLocationsOptions([]);
    }
  }, [trip]);

  // actual delete action from menu
  const handleDeletePlace = async (ev, place) => {
    ev.stopPropagation(); // keep the menu open handler from closing prematurely
    if (!place || !place.id) return;
    const ok = window.confirm(
      `¿Seguro que deseas eliminar el punto "${place.title || place.location?.titulo || ""
      }"?`
    );
    if (!ok) {
      setMenuOpen(null);
      return;
    }
    try {
      await apiDelete(`/trips/${tripId}/places/${place.id}`);
      // refresh trip
      const fresh = await apiGet(`/trips/${tripId}`);
      setTrip(fresh);
      setMenuOpen(null);
    } catch (err) {
      console.error("Error eliminando punto:", err);
      alert(
        "No se pudo eliminar el punto. Revisa la consola para más detalle."
      );
    }
  };

  // group places by date & helper (unchanged)
  const groupPlacesByDate = (places) => {
    const groups = {};
    (places || []).forEach((p) => {
      const dateKey = p?.date ? String(p.date).split("T")[0] : "no-date";
      groups[dateKey] = groups[dateKey] || [];
      groups[dateKey].push(p);
    });
    const keys = Object.keys(groups).sort((a, b) => {
      if (a === "no-date") return 1;
      if (b === "no-date") return -1;
      return new Date(a) - new Date(b);
    });
    keys.forEach((k) => {
      groups[k].sort((x, y) => {
        const sx = (x.start_hour || "00:00").split(":").map(Number);
        const sy = (y.start_hour || "00:00").split(":").map(Number);
        const mx =
          (Number.isFinite(sx[0]) ? sx[0] : 0) * 60 +
          (Number.isFinite(sx[1]) ? sx[1] : 0);
        const my =
          (Number.isFinite(sy[0]) ? sy[0] : 0) * 60 +
          (Number.isFinite(sy[1]) ? sy[1] : 0);
        return mx - my;
      });
    });
    return { groups, keys };
  };

  // markers derived from trip.places (defensive filter: only finite coords)
  const markers = (trip?.places || [])
    .map((p) => {
      const loc = p.location || {};
      const latRaw =
        loc.latitude !== undefined
          ? loc.latitude
          : loc.latitud !== undefined
            ? loc.latitud
            : null;
      const lngRaw =
        loc.longitude !== undefined
          ? loc.longitude
          : loc.longitud !== undefined
            ? loc.longitud
            : null;
      const lat = latRaw !== null ? Number(latRaw) : null;
      const lng = lngRaw !== null ? Number(lngRaw) : null;
      return {
        place: p,
        latitude: lat,
        longitude: lng,
        title: loc.titulo ?? p.location?.titulo ?? `Lugar #${p.fk_location}`,
        images: loc.imagenes ?? loc.images ?? p.images ?? [],
      };
    })
    .filter((m) => Number.isFinite(m.latitude) && Number.isFinite(m.longitude));

  // helper to obtain website for place/location
  const getWebsiteFor = (p) => {
    if (!p) return null;
    const candidates = [
      p.website,
      p.link,
      p.url,
      p.location?.website,
      p.location?.url,
      p.location?.website_url,
    ];
    return (
      candidates.find((c) => typeof c === "string" && c.trim().length > 0) ??
      null
    );
  };

  // small helper for past check
  const normalizeDate = (d) => {
    if (!d) return new Date();
    const date = String(d).split("T")[0].split("-");
    const yy = Number(date[0]);
    const mm = Number(date[1]) - 1;
    const dd = Number(date[2]);
    return new Date(yy, mm, dd);
  };
  const pastPlace = (d, et) => {
    if (!d || !et) return false;
    const today = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate()
    );
    if (normalizeDate(d).getTime() === today.getTime()) {
      const [eh, em] = (et || "00:00").split(":").map(Number);
      const endMinutes =
        (Number.isFinite(eh) ? eh : 0) * 60 + (Number.isFinite(em) ? em : 0);
      const t = new Date();
      const currentTime = t.getHours() * 60 + t.getMinutes();
      return endMinutes < currentTime;
    }
    return normalizeDate(d) < today;
  };

  // ---------- Route drawing helpers ----------
  const coordsToLngLat = (p) => [
    Number(
      p.location?.longitude ?? p.location?.longitud ?? p.location?.lng ?? 0
    ),
    Number(p.location?.latitude ?? p.location?.lat ?? p.location?.latitud ?? 0),
  ];
  const computeCenterAndZoom = (lnglats) => {
    if (!lnglats || lnglats.length === 0)
      return { center: viewState, zoom: viewState.zoom };
    let minLng = Infinity,
      minLat = Infinity,
      maxLng = -Infinity,
      maxLat = -Infinity;
    lnglats.forEach(([lng, lat]) => {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    });
    const centerLng = (minLng + maxLng) / 2;
    const centerLat = (minLat + maxLat) / 2;
    const deltaLng = Math.abs(maxLng - minLng);
    const deltaLat = Math.abs(maxLat - minLat);
    const maxDelta = Math.max(deltaLng, deltaLat);
    // heuristic zoom based on span (loose mapping)
    let zoom;
    if (maxDelta < 0.005) zoom = 16;
    else if (maxDelta < 0.02) zoom = 15;
    else if (maxDelta < 0.1) zoom = 13;
    else if (maxDelta < 0.5) zoom = 11;
    else if (maxDelta < 2) zoom = 8;
    else zoom = 4;
    return { center: { latitude: centerLat, longitude: centerLng }, zoom };
  };

  const showRouteForDate = (dateKey, groupedPlaces) => {
    // toggle if same date
    if (activeRouteDateKey === dateKey) {
      setActiveRouteDateKey(null);
      setDayRouteGeoJSON(null);
      setDayRoutePoints([]);
      return;
    }

    const places = (groupedPlaces[dateKey] || []).filter((p) => {
      const lat = Number(
        p.location?.latitude ?? p.location?.latitud ?? p.location?.lat
      );
      const lng = Number(
        p.location?.longitude ?? p.location?.longitud ?? p.location?.lng
      );
      return Number.isFinite(lat) && Number.isFinite(lng);
    });

    if (places.length === 0) {
      setActiveRouteDateKey(dateKey);
      setDayRouteGeoJSON(null);
      setDayRoutePoints([]);
      return;
    }

    // ensure places sorted by start_hour (groupPlacesByDate already sorts, but be defensive)
    places.sort((a, b) => {
      const sa = (a.start_hour || "00:00").split(":").map(Number);
      const sb = (b.start_hour || "00:00").split(":").map(Number);
      const ma =
        (Number.isFinite(sa[0]) ? sa[0] : 0) * 60 +
        (Number.isFinite(sa[1]) ? sa[1] : 0);
      const mb =
        (Number.isFinite(sb[0]) ? sb[0] : 0) * 60 +
        (Number.isFinite(sb[1]) ? sb[1] : 0);
      return ma - mb;
    });

    const coords = places.map((p) => {
      const lat = Number(
        p.location?.latitude ?? p.location?.latitud ?? p.location?.lat
      );
      const lng = Number(
        p.location?.longitude ?? p.location?.longitud ?? p.location?.lng
      );
      return [lng, lat];
    });

    const geojson = {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: coords,
      },
      properties: {},
    };

    setActiveRouteDateKey(dateKey);
    setDayRouteGeoJSON(geojson);
    setDayRoutePoints(
      places.map((p, i) => ({
        index: i + 1,
        place: p,
        lnglat: coords[i],
      }))
    );

    // center & zoom map to route
    const { center, zoom } = computeCenterAndZoom(coords);
    setViewState((v) => ({
      ...v,
      latitude: center.latitude,
      longitude: center.longitude,
      zoom,
    }));
  };

  // ---------------- Lazy-load popup image when user opens a place ----------------
  useEffect(() => {
    let imgObj = null;
    if (
      !selectedLocationOnMap ||
      !selectedLocationOnMap.imageUrl ||
      !selectedLocationOnMap.loadImage
    )
      return undefined;

    const url = selectedLocationOnMap.imageUrl;
    // start loading
    imgObj = new Image();
    imgObj.src = url;
    imgObj.onload = () => {
      setSelectedLocationOnMap((prev) => {
        if (!prev) return prev;
        // only set if imageUrl hasn't changed in the meantime
        if (prev.imageUrl === url) {
          return { ...prev, image: url, imageLoading: false };
        }
        return prev;
      });
    };
    imgObj.onerror = () => {
      setSelectedLocationOnMap((prev) =>
        prev ? { ...prev, imageLoading: false } : prev
      );
    };

    return () => {
      if (imgObj) {
        imgObj.onload = null;
        imgObj.onerror = null;
      }
    };
  }, [selectedLocationOnMap?.imageUrl, selectedLocationOnMap?.loadImage]);

  // ---------- UI rendering ----------
  if (loading) {
    return (
      <div className="trip-it-root">
        <main
          className="trip-it-main"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "80vh",
          }}
        >
          <div style={{ fontSize: 25 }}> Cargando itinerario… </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="trip-it-root">
        <Header />
        <main className="trip-it-main">
          <div style={{ padding: 24 }}>
            <button className="back-link" onClick={() => navigate("/trips")}>
              ← Volver a viajes
            </button>
            <div style={{ marginTop: 18, color: "#b00020" }}>{error}</div>
          </div>
        </main>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="trip-it-root">
        <Header />
      </div>
    );
  }

  // ---------- Flight card (AddTrip-like) ----------
  const flightCard = (
    <section
      className="card card--white"
      style={{
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
        boxShadow: "0 0.375rem 1.25rem rgba(12,13,14,0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 18 }}>Vuelos</h3>
        <div style={{ color: "#666", fontSize: 13 }}>
          {displayTripDestination}
        </div>
      </div>

      {backendFlight ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div>

            {/* show airline & label */}
            {backendFlightDetails?.label ? (
              <div style={{ color: "#222", marginTop: 6, fontWeight: 600 }}>
                {backendFlightDetails.label}
              </div>
            ) : null}

            <div style={{ color: "#666", marginTop: 6 }}>
              {backendFlightDetails?.meta?.times
                ? backendFlightDetails.meta.times +
                (backendFlightDetails?.meta?.price
                  ? `${backendFlightDetails.meta.price}`
                  : "")
                : backendFlight.created_at
                  ? fmtDate(backendFlight.created_at)
                  : ""}
            </div>

            {backendFlightDetails?.meta?.duration ? (
              <div style={{ color: "#666", marginTop: 4, fontSize: 13 }}>
                {backendFlightDetails.meta.duration}
              </div>
            ) : null}
          </div>
{/* <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn-secondary"
              onClick={async () => {
                const fid = backendFlight.flight_id;
                if (!fid) return;
                setLoadingFlight(true);
                try {
                  // refresh basic backend record
                  const bf = await apiGet(
                    `/flights/${encodeURIComponent(String(fid))}`
                  ).catch(() => null);
                  if (bf) setBackendFlight(bf);

                  // attempt to refresh enriched details from flightsApi
                  if (typeof flightsApi.getOfferById === "function") {
                    try {
                      const rawOffer = await flightsApi.getOfferById(
                        String(fid)
                      );
                      if (rawOffer) {
                        const mapped = mapOfferToSelectOption(rawOffer);
                        setBackendFlightDetails(mapped);
                        setSelectedFlightOption(mapped);
                        setFlightMessage(
                          "Refrescado (detalle de vuelo obtenido)."
                        );
                      } else {
                        setBackendFlightDetails(null);
                        setFlightMessage(
                          "Refrescado (no se obtuvieron detalles del vuelo)."
                        );
                      }
                    } catch (err) {
                      console.warn(
                        "refresh flightsApi getOfferById failed",
                        err
                      );
                      setFlightMessage(
                        "Refrescado (no se pudieron obtener detalles externos)."
                      );
                    }
                  } else {
                    setFlightMessage("Refrescado.");
                  }
                } catch (e) {
                  console.warn(e);
                  setFlightMessage("Error al refrescar.");
                } finally {
                  setLoadingFlight(false);
                  window.setTimeout(() => setFlightMessage(null), 3000);
                }
              }}
            >
              Refrescar
            </button>
            <button className="btn-secondary" onClick={handleRemoveFlight}>
              Quitar vuelo
            </button>
          </div>*/}
         
        </div>
      ) : (
        <div>
          <div className="flights-grid" style={{ marginTop: 8 }}>
            <div className="field">
              <label
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontSize: 13,
                  color: "#444",
                }}
              >
                País de origen
              </label>
              <Select
                options={countryOptions}
                value={
                  countryOptions.find((c) => c.value === originCountryIso) ||
                  null
                }
                onChange={(opt) => setOriginCountryIso(opt ? opt.value : null)}
                placeholder="Seleccioná país de origen"
                className="dropdown-select"
                classNamePrefix="react-select"
                isClearable
              />
            </div>

            <div className="field">
              <label
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontSize: 13,
                  color: "#444",
                }}
              >
                Ciudad de origen
              </label>
              <Select
                className="dropdown-select"
                classNamePrefix="react-select"
                options={originCityOptions}
                value={originCityValue}
                onChange={(val) => setOriginCityValue(val)}
                onInputChange={(inputValue) => {
                  fetchOriginCityOptions(String(inputValue || ""));
                  return inputValue;
                }}
                placeholder={
                  originCountryIso
                    ? "Escribe mínimo 2 letras para buscar ciudad"
                    : "Seleccioná país primero"
                }
                isClearable
                noOptionsMessage={() => "Escribe para buscar ciudades"}
                isDisabled={!originCountryIso}
              />
            </div>

            <div className="field">
              <label
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontSize: 13,
                  color: "#444",
                }}
              >
                Aeropuerto de origen
              </label>
              <Select
                className="dropdown-select"
                classNamePrefix="react-select"
                options={originAirportOptions}
                value={originAirportValue}
                onChange={(opt) => setOriginAirportValue(opt)}
                placeholder={
                  originAirportsLoading
                    ? "Cargando aeropuertos..."
                    : originAirportOptions.length === 0
                      ? "Seleccioná ciudad para cargar aeropuertos"
                      : "Selecciona aeropuerto de origen"
                }
                isClearable
                isDisabled={!!originAirportsLoading}
                onFocus={() => {
                  if (
                    (originAirportOptions || []).length === 0 &&
                    originCityValue
                  ) {
                    const cityName =
                      originCityValue?.meta?.cityName ||
                      originCityValue?.label ||
                      String(originCityValue?.value || "");
                    fetchOriginAirports(cityName);
                  }
                }}
              />
            </div>

            <div className="field">
              <label
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontSize: 13,
                  color: "#444",
                }}
              >
                Aeropuerto de destino
              </label>
              <Select
                className="dropdown-select"
                classNamePrefix="react-select"
                options={destinationAirportOptions}
                value={destinationAirportValue}
                onChange={(opt) => setDestinationAirportValue(opt)}
                placeholder={
                  destinationAirportsLoading
                    ? "Cargando aeropuertos..."
                    : destinationAirportOptions.length === 0
                      ? "Selecciona aeropuerto de destino"
                      : "Selecciona aeropuerto de destino"
                }
                isClearable
                isDisabled={!!destinationAirportsLoading}
                onFocus={() => {
                  if ((destinationAirportOptions || []).length > 0) return;
                  const destRaw = trip?.destination || "";
                  if (!destRaw) return;
                  const parsed = parseCityCountryFromString(destRaw);
                  const city = parsed.cityName || destRaw;
                  const country = parsed.countryName || "";
                  const iso = getIsoFromCountryName(country);
                  fetchDestinationAirports(city || destRaw, 200, iso);
                }}
              />
            </div>

            <div className="field wide">
              <label
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontSize: 13,
                  color: "#444",
                }}
              >
                Vuelos disponibles
              </label>
              <Select
                className="dropdown-select"
                classNamePrefix="react-select"
                options={flightOffers}
                value={selectedFlightOption}
                onChange={(opt) => setSelectedFlightOption(opt)}
                placeholder={
                  offersLoading
                    ? "Buscando vuelos..."
                    : "Seleccioná un vuelo (si hay)"
                }
                isClearable
                isDisabled={offersLoading || !(flightOffers?.length > 0)}
                formatOptionLabel={(option) => {
                  const m = option.meta || {};
                  return (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>
                        {m.flightCode
                          ? `${m.flightCode} ${option.label.replace(
                            /^[^·]+·\s*/,
                            ""
                          )}`
                          : option.label}
                      </div>
                      <div
                        style={{
                          textAlign: "right",
                          fontSize: 13,
                          color: "#333",
                        }}
                      >
                        {m.times && (
                          <div style={{ marginBottom: 2 }}>{m.times}</div>
                        )}
                        <div style={{ color: "#666", fontSize: 12 }}>
                          {m.duration || ""}
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
            <button
              className="btn-primary"
              style={{ marginTop: 15 }}
              onClick={handleSaveSelectedFlight}
              disabled={loadingFlight || !selectedFlightOption}
            >
              {loadingFlight ? "Guardando..." : "Guardar vuelo"}
            </button>
          </div>

          {flightMessage && (
            <div style={{ marginTop: 10, color: "#333" }}>{flightMessage}</div>
          )}
        </div>
      )}
    </section>
  );

  // ---------- Add location from city card ----------
  // ---------- Add location (only from trip's city) ----------
  const addLocationCard = (
    <section
      className="card card--white"
      style={{
        marginBottom: 16,
        padding: 16,
        borderRadius: 12,
        boxShadow: "0 0.375rem 1.25rem rgba(12,13,14,0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 10,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 18 }}>
          Agregar lugares de la ciudad del viaje
        </h3>
        <div style={{ color: "#666", fontSize: 13 }}>
          {displayTripDestination}
        </div>
      </div>

      <div style={{ marginTop: 6 }}>
        <div style={{ marginBottom: 8, fontSize: 13, color: "#444" }}>
          Seleccioná lugar (solo lugares de la ciudad del itinerario)
        </div>

        <Select
          className="dropdown-select"
          classNamePrefix="react-select"
          options={locationsOptions}
          value={selectedLocationOption}
          onChange={(opt) => setSelectedLocationOption(opt)}
          isLoading={locationsLoading}
          placeholder={
            locationsLoading
              ? "Cargando lugares..."
              : locationsOptions.length === 0
                ? "No hay lugares para mostrar"
                : "Seleccioná un lugar"
          }
          isClearable
          onFocus={() => {
            // ensure locations are loaded on focus
            const parsed = parseCityCountryFromString(trip.destination || "");
            const country = parsed.countryName || trip.destination || "";
            const city = parsed.cityName || "";
            fetchLocationsForCountry(country, city);
          }}
          noOptionsMessage={() =>
            locationsLoading ? "Cargando..." : "No hay lugares en la ciudad"
          }
          formatOptionLabel={(opt) => {
            const meta = opt?.meta || {};
            const city = meta?.city || "";
            return (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 700 }}>{opt.label}</div>
                <div style={{ color: "#666", fontSize: 12 }}>
                  {city || meta?.country || ""}
                </div>
              </div>
            );
          }}
        />
      </div>

      <div
        style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}
      >
        <button
          className="btn-primary"
          style={{ marginTop: 15 }}
          onClick={handleAddLocationToItinerary}
          disabled={addingLocation || !selectedLocationOption}
        >
          {addingLocation ? "Agregando..." : "Agregar al itinerario"}
        </button>

        {addLocationMessage && (
          <div style={{ marginLeft: 8, color: "#333" }}>
            {addLocationMessage}
          </div>
        )}
      </div>
    </section>
  );

  // ---------- Right-hand place detail component ----------
  const PlaceDetail = ({ p }) => {
    const loc = p.location || {};
    const image =
      (loc.imagenes && loc.imagenes[0]) ||
      (loc.images && loc.images[0]) ||
      (p.images && p.images[0]) ||
      null;
    const website = getWebsiteFor(p) || getWebsiteFor(loc);
    return (
      <div
        className="place-detail"
        style={{
          padding: 16,
          borderRadius: 12,
          background: "#fff",
          boxShadow: "0 0.5rem 1.875rem rgba(12,13,14,0.06)",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* unchanged */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          {image ? (
            <img
              src={image}
              alt="Lugar"
              style={{
                width: 220,
                height: 140,
                objectFit: "cover",
                borderRadius: 10,
              }}
            />
          ) : (
            <div
              style={{
                width: 220,
                height: 140,
                borderRadius: 10,
                background: "#f3f3f3",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#999",
              }}
            >
              Sin imagen
            </div>
          )}
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 22 }}>
              {loc.titulo ?? p.title ?? `Lugar #${p.fk_location}`}
            </h2>
            <div style={{ color: "#666", marginTop: 6 }}>
              {fmtDate(p.date)}{" "}
              {p.start_hour
                ? `· ${String(p.start_hour).slice(0, 5)}${p.end_hour ? ` — ${String(p.end_hour).slice(0, 5)}` : ""
                }`
                : ""}
            </div>
            {website && (
              <div style={{ marginTop: 10 }}>
                <a
                  href={
                    website.startsWith("http") ? website : `https://${website}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: primaryLight }}
                >
                  Ver sitio
                </a>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: "1rem", flex: 1 }}>
          <h4 style={{ margin: "0 0 0.5rem 0" }}>Notas</h4>
          <div style={{ color: "#333", lineHeight: 1.5 }}>{p.notes || "-"}</div>

          <div style={{ marginTop: "1.125rem" }}>
            <h4 style={{ margin: "0 0 8px 0" }}>Ubicación</h4>
            <div style={{ color: "#333" }}>
              {loc.titulo || loc.address || "Sin dirección"}
            </div>
            {Number.isFinite(Number(loc.latitude)) &&
              Number.isFinite(Number(loc.longitude)) && (
                <div style={{ marginTop: 10 }}>
                  <button
                    className="btn-secondary"
                    style={{ marginTop: 15 }}
                    onClick={() => {
                      // center map on this place
                      setViewState((v) => ({
                        ...v,
                        latitude: Number(loc.latitude ?? loc.latitud),
                        longitude: Number(loc.longitude ?? loc.longitud),
                        zoom: 16,
                      }));
                    }}
                  >
                    Ver en mapa
                  </button>
                </div>
              )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 12,
          }}
        >
          <button
            className="btn-secondary"
            onClick={() =>
              navigate(
                `/edit-place/${trip.id}?placeIndex=${(
                  trip.places || []
                ).findIndex((pp) => pp.id === p.id)}`
              )
            }
          >
            Editar
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              if (window.confirm("¿Eliminar este punto del itinerario?"))
                apiDelete(`/trips/${tripId}/places/${p.id}`).then(() =>
                  apiGet(`/trips/${tripId}`).then(setTrip)
                );
            }}
          >
            Eliminar
          </button>
        </div>
      </div>
    );
  };

  const { groups: groupedPlaces, keys: groupKeys } = groupPlacesByDate(
    trip.places || []
  );

  return (
    <div
      className="trip-it-root"
      style={{ background: "#f6f7f9", minHeight: "100vh" }}
    >
      <Header />

      <main
        className="trip-it-main"
        style={{
          gridTemplateColumns: "1fr 35rem",
        }}
      >
        <section className="trip-it-left">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <div>
              {/*<button className="back-link" onClick={() => navigate("/trips")}>
                ← Volver a viajes
              </button>*/}
              <h2 style={{ marginTop: 8, marginBottom: 4 }}>
                {displayTripDestination}
              </h2>
              <div style={{ color: "#666" }}>
                {fmtDate(trip.start_date)} — {fmtDate(trip.end_date)}
              </div>
            </div>
            <div
              style={{
                background: "#ff3951",
                height: 3,
                marginBottom: 20,
                marginTop: 10,
              }}
            ></div>

            <div style={{ textAlign: "right" }}>
              <div style={{ color: "#888", fontSize: 13 }}>Creado</div>
              <div style={{ fontWeight: 700 }}>{fmtDate(trip.created_at)}</div>
            </div>
          </div>

          <section style={{ overflowY: "auto", paddingRight: 20 }}>
            {/* Flight card */}
            {flightCard}
            {/* Add location from city card */}
            {addLocationCard}
            <h3 style={{ marginTop: 18, marginBottom: 8 }}>
              Itinerario por día
            </h3>

            <div style={{ marginTop: 8 }}>
              {groupKeys.length === 0 ? (
                <div className="muted">Aún no hay puntos en el itinerario.</div>
              ) : (
                groupKeys.map((dateKey) => {
                  const dayPlaces = groupedPlaces[dateKey] || [];
                  const hasCoords = dayPlaces.some((p) => {
                    const lat = Number(
                      p.location?.latitude ??
                      p.location?.latitud ??
                      p.location?.lat
                    );
                    const lng = Number(
                      p.location?.longitude ??
                      p.location?.longitud ??
                      p.location?.lng
                    );
                    return Number.isFinite(lat) && Number.isFinite(lng);
                  });
                  const isActive = activeRouteDateKey === dateKey;

                  return (
                    <div key={dateKey} style={{ marginBottom: 18 }}>
                      {/* day header */}
                      <div
                        className="day-header"
                        style={{
                          background: isActive ? primaryLight : "#fff",
                          color: isActive ? "#fff" : "#222",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 15 }}>
                            {dateKey === "no-date"
                              ? "Fecha sin especificar"
                              : fmtDate(dateKey)}
                          </div>
                          <div
                            style={{
                              color: isActive
                                ? "rgba(255,255,255,0.85)"
                                : "#666",
                              fontSize: 13,
                            }}
                          >
                            {dayPlaces.length} punto
                            {dayPlaces.length > 1 ? "s" : ""}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          {/* Mostrar ruta button */}
                          {hasCoords && (
                            <button
                              className={`btn-outline ${isActive ? "active" : ""
                                }`}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                showRouteForDate(dateKey, groupedPlaces);
                              }}
                              title={isActive ? "Ocultar ruta" : "Mostrar ruta"}
                            >
                              {/* small route icon */}
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                style={{ marginRight: 8 }}
                              >
                                <path
                                  d="M3 12h4l3-8 4 16 3-8h4"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                              <span style={{ fontSize: 13 }}>
                                {isActive ? "Ocultar ruta" : "Mostrar ruta"}
                              </span>
                            </button>
                          )}

                          {/* Añadir button */}
                          <button
                            className="btn-small"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              navigate(`/add_place/${tripId}?date=${dateKey}`);
                            }}
                            title="Añadir punto a este día"
                          >
                            + Añadir
                          </button>
                        </div>
                      </div>

                      {/* subtle separator between header and items */}
                      <div className="day-separator" />

                      <div style={{ marginTop: 8 }}>
                        {dayPlaces.map((p, i) => {
                          const loc = p.location || {};
                          const lat = Number(
                            loc.latitude ?? loc.latitud ?? null
                          );
                          const lng = Number(
                            loc.longitude ?? loc.longitud ?? null
                          );
                          const website =
                            getWebsiteFor(p) || getWebsiteFor(loc);
                          const isPast = pastPlace(p.date, p.end_hour);

                          return (
                            <div
                              key={p.id ?? `${dateKey}-${i}`}
                              className="place-item"
                              style={{
                                border: `1px solid ${selectedLocationOnMap &&
                                  selectedLocationOnMap.place?.id === p.id
                                  ? "#ff3951"
                                  : "#eee"
                                  }`,
                                backgroundColor: isPast ? "#fafafa" : "#fff",
                              }}
                              onMouseEnter={(e) =>
                              (e.currentTarget.style.boxShadow =
                                "0 0.5rem 1.25rem rgba(12,13,14,0.06)")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.boxShadow = "none")
                              }
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 30,
                                  flex: 1,
                                }}
                              >
                                <div style={{ minWidth: 92 }}>
                                  <div
                                    style={{
                                      fontSize: 14,
                                      color: "#222",
                                      fontWeight: 700,
                                    }}
                                  >
                                    {p.start_hour
                                      ? String(p.start_hour).slice(0, 5)
                                      : "—"}{" "}
                                    {p.end_hour
                                      ? `— ${String(p.end_hour).slice(0, 5)}`
                                      : ""}
                                  </div>
                                </div>

                                <div style={{ flex: 1 }}>
                                  <div
                                    style={{ fontSize: 15, fontWeight: 600 }}
                                  >
                                    {p.title ??
                                      p.location?.titulo ??
                                      `Actividad`}
                                  </div>
                                  {p.notes && (
                                    <div
                                      style={{ fontSize: 13, color: "#444" }}
                                    >
                                      {p.notes}
                                    </div>
                                  )}
                                  {website && (
                                    <div style={{ marginTop: 6 }}>
                                      <a
                                        href={
                                          website.startsWith("http")
                                            ? website
                                            : `https://${website}`
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                          color: "#FF7485",
                                          fontSize: 13,
                                        }}
                                      >
                                        Ver sitio
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                }}
                              >
                                <div
                                    onClick={() => {
                                        // when user clicks a place, center map immediately and start lazy-loading image
                                        if (selectedLocationOnMap?.place?.id === p.id) {
                                            setSelectedLocationOnMap(null);
                                            setClickOnMap(false);
                                        } else {
                                            const imageUrl =
                                                (loc.imagenes && loc.imagenes[0]) ||
                                                (loc.images && loc.images[0]) ||
                                                (p.images && p.images[0]) ||
                                                null;
                                            setSelectedLocationOnMap({
                                                latitude: lat,
                                                longitude: lng,
                                                place: p,
                                                titulo: loc.titulo ?? p.title,
                                                image: null, // not loaded yet
                                                imageUrl: imageUrl,
                                                loadImage: !!imageUrl, // only load if we have an url
                                                imageLoading: !!imageUrl,
                                            });
                                            if (
                                                Number.isFinite(lat) &&
                                                Number.isFinite(lng)
                                            ) {
                                                setViewState((v) => ({
                                                    ...v,
                                                    latitude: lat,
                                                    longitude: lng,
                                                    zoom: 14,
                                                }));
                                            }
                                        }
                                    }}
                                  style={{
                                      width: 38,
                                      height: 38,
                                      borderRadius: 8,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      background: selectedLocationOnMap && selectedLocationOnMap.place?.id === p.id
                                          ? "#ff3951"
                                          : "#fff"
                                      ,
                                    border: "1px solid #eee",
                                      cursor: "pointer",
                                  }}
                                    className="place-icon"
                                >
                                  <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill= {selectedLocationOnMap && selectedLocationOnMap.place?.id === p.id
                                    ? "#fff"
                                    : "#ff3951"}
                                  >
                                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>
                                  </svg>
                                </div>

                                {/* menu wrapper: position relative so menu absolute aligns to button */}
                                <div
                                  className="trip-menu-wrapper"
                                  style={{ position: "relative" }}
                                  ref={menuContainerRef}
                                >
                                  <button
                                    className="trip-menu-btn"
                                    onClick={(ev) => togglePlaceMenu(ev, p.id)}
                                    aria-haspopup="true"
                                    aria-expanded={menuOpen === p.id}
                                  >
                                    ⋮
                                  </button>

                                  {/* menu: rendered when menuOpen === place id */}
                                  {menuOpen === p.id && (
                                    <div
                                      className="trip-menu"
                                      onClick={(e) => e.stopPropagation()} // prevent document click from immediately closing
                                      style={{
                                        position: "absolute",
                                        top: "calc(100% + 0.375rem)",
                                        right: 0,
                                        zIndex: 30,
                                      }}
                                    >
                                      {/* edit */}
                                      <button
                                        className="trip-menu-btn"
                                        onClick={(ev) => {
                                          ev.stopPropagation();
                                          navigate(
                                            `/edit-place/${trip.id
                                            }?placeIndex=${(
                                              trip.places || []
                                            ).findIndex(
                                              (pp) => pp.id === p.id
                                            )}`
                                          );
                                          setMenuOpen(null);
                                        }}
                                        title="Editar punto"
                                      >
                                        ✎
                                      </button>

                                      {/* delete */}
                                      <button
                                        className="trip-menu-btn"
                                        onClick={(ev) =>
                                          handleDeletePlace(ev, p)
                                        }
                                        title="Eliminar punto"
                                      >
                                        🗑
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ marginTop: 10 }}>
              <button
                onClick={() => navigate(`/add_place/${tripId}`)}
                className="btn-primary"
              >
                Agregar al itinerario
              </button>
            </div>
          </section>
        </section>

        {/* Right column: map / selected place / route */}
        <section className="trip-it-right">
          <div
            className="map-wrapper"
            style={{
              height: "100%",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 0.625rem 1.875rem rgba(12,13,14,0.06)",
            }}
          >
            <Map
              {...viewState}
              onMove={(evt) => {
                if (evt?.viewState) setViewState(evt.viewState);
              }}
              style={{ width: "100%", height: "100%" }}
              mapStyle="mapbox://styles/mapbox/streets-v11"
              mapboxAccessToken={MAPBOX_TOKEN}
            >
              <div
                style={{ position: "absolute", right: 10, top: 10, zIndex: 1 }}
              >
                <NavigationControl showCompass showZoom />
              </div>

              {/* day route (line) */}
              {dayRouteGeoJSON && (
                <Source id="day-route" type="geojson" data={dayRouteGeoJSON}>
                  <Layer
                    id="day-route-line"
                    type="line"
                    paint={{
                      "line-color": "#FF7485",
                      "line-width": 5,
                      "line-opacity": 0.95,
                    }}
                  />
                  <Layer
                    id="day-route-line-outline"
                    type="line"
                    paint={{
                      "line-color": "#ffffff",
                      "line-width": 8,
                      "line-opacity": 0.15,
                    }}
                  />
                </Source>
              )}

              {/* markers for route points (numbered) */}
              {dayRoutePoints &&
                dayRoutePoints.map((pt, idx) => (
                  <Marker
                    key={`route-point-${idx}`}
                    longitude={Number(pt.lnglat[0])}
                    latitude={Number(pt.lnglat[1])}
                    anchor="center"
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 18,
                        background: "#FF7485",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        boxShadow: primaryRgb
                          ? `0 0.375rem 1.125rem rgba(${primaryRgb.r},${primaryRgb.g},${primaryRgb.b},0.18)`
                          : "0 0.375rem 1.125rem rgba(25,120,200,0.18)",
                      }}
                    >
                      {pt.index}
                    </div>
                  </Marker>
                ))}

              {/* place markers */}
              {markers.map((m) => (
                <Marker
                  key={`m-${m.place.id}`}
                  longitude={Number(m.longitude)}
                  latitude={Number(m.latitude)}
                  anchor="center"
                >
                  <div
                    onMouseEnter={(e) => {
                      try {
                        if (
                          e?.nativeEvent &&
                          typeof e.nativeEvent.stopImmediatePropagation ===
                          "function"
                        )
                          e.nativeEvent.stopImmediatePropagation();
                      } catch (e) { }
                      e.stopPropagation();
                      if (
                        !Number.isFinite(Number(m.latitude)) ||
                        !Number.isFinite(Number(m.longitude))
                      )
                        return;
                      // hover: don't load image (so we don't hammer network)
                      const img =
                        m.images && m.images.length ? m.images[0] : null;
                      if (
                        selectedLocationOnMap &&
                        selectedLocationOnMap.titulo !== m.title
                      )
                        setClickOnMap(false);
                      setSelectedLocationOnMap({
                        latitude: m.latitude,
                        longitude: m.longitude,
                        place: m.place,
                        titulo: m.title,
                        image: null,
                        imageUrl: img,
                        loadImage: false,
                        imageLoading: false,
                      });
                    }}
                    onMouseLeave={(e) => {
                      try {
                        if (
                          e?.nativeEvent &&
                          typeof e.nativeEvent.stopImmediatePropagation ===
                          "function"
                        )
                          e.nativeEvent.stopImmediatePropagation();
                      } catch (e) { }
                      e.stopPropagation();
                      if (!clickOnMap) setSelectedLocationOnMap(null);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        !Number.isFinite(Number(m.latitude)) ||
                        !Number.isFinite(Number(m.longitude))
                      )
                        return;
                      // click: center + load image
                      setClickOnMap(!clickOnMap);
                      const img = m.images && m.images.length ? m.images[0] : null;
                      setViewState((v) => ({
                        ...v,
                        latitude: Number(m.latitude),
                        longitude: Number(m.longitude),
                        zoom: 16,
                      }));
                      setSelectedLocationOnMap({
                        latitude: m.latitude,
                        longitude: m.longitude,
                        place: m.place,
                        titulo: m.title,
                        image: null,
                        imageUrl: img,
                        loadImage: !!img,
                        imageLoading: !!img,
                      });
                    }}
                    style={{
                      cursor: "pointer",
                      pointerEvents: "auto",
                      transform: "translateY(-0.375rem)",
                    }}
                  >
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      style={{ display: "block" }}
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                        fill="#ff3951"
                      />
                      <circle cx="12" cy="9" r="2.5" fill="#fff" />
                    </svg>
                  </div>
                </Marker>
              ))}

              {selectedLocationOnMap &&
                Number.isFinite(Number(selectedLocationOnMap.latitude)) &&
                Number.isFinite(Number(selectedLocationOnMap.longitude)) && (
                  <Popup
                    longitude={Number(selectedLocationOnMap.longitude)}
                    latitude={Number(selectedLocationOnMap.latitude)}
                    anchor="bottom"
                    closeButton={false}
                    offset={[0, -20]}
                  >
                    <div className="place-popUp">
                      {/* if image is loading show spinner */}
                      {selectedLocationOnMap.imageLoading ? (
                        <div style={{ width: '3.125rem', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div className="img-spinner" />
                        </div>
                      ) : selectedLocationOnMap.imageUrl && <div className="img-popup-container">
                        <img src={selectedLocationOnMap.imageUrl} className="img-popUp" alt="Lugar actual" /></div>
                      }

                      <div className="place-info" style={{ paddingTop: 8 }}>
                        <h3>
                          {selectedLocationOnMap.titulo}
                        </h3>
                        {selectedLocationOnMap.place?.date && (
                          <p style={{ margin: 0 }}>
                            {fmtDate(selectedLocationOnMap.place.date)}
                          </p>
                        )}
                        {selectedLocationOnMap.place?.start_hour && (
                          <p style={{ margin: 0 }}>
                            {String(
                              selectedLocationOnMap.place.start_hour
                            ).slice(0, 5)}{" "}
                            -{" "}
                            {String(selectedLocationOnMap.place.end_hour).slice(
                              0,
                              5
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  </Popup>
                )}
            </Map>
          </div>
        </section>
      </main>
    </div>
  );
}
