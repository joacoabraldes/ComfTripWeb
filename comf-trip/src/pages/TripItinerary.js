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
import "../styles/header.css";
import Select from "react-select";
import { apiDelete, apiGet, apiPost, apiPut } from "./api";
import flightsApi from "../services/flightsApi";
import { Country } from "country-state-city";
import { useTranslation } from "../i18n";
import { FaMapMarkedAlt, FaEdit, FaTrash } from "react-icons/fa";
import IconButton from "../components/IconButton";
import LoadingSpinner from "../components/LoadingSpinner";
import ConfirmDialog from "../components/ConfirmDialog";
import { normalizeDate, getTripStatus, isTripPast } from "../utils/dateUtils";
import FlightFinderItinerary from "../components/FlightFinderItinerary";

// NEW: summary + finder components
import TripFlightSummary, {
  buildSummaryFromBackendDetails,
} from "../components/TripFlightSummary";
import FlightFinder from "../components/FlightFinder";

const MAPBOX_TOKEN =
  process.env.REACT_APP_MAPBOX_TOKEN ||
  "pk.eyJ1IjoibWFuZHJhY2EiLCJhIjoiY21mZnE1dmI0MDlubjJpcG5rYmw3ZnRiZiJ9.RwdRSwXlP1PX_7j7cwUsMA";

export default function TripItinerary() {
  const params = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
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

  // flight/backend state (backend association + enriched details)
  const [backendFlight, setBackendFlight] = useState(null);
  const [backendFlightDetails, setBackendFlightDetails] = useState(null);
  const [loadingFlight, setLoadingFlight] = useState(false);
  const [flightMessage, setFlightMessage] = useState(null);

  // ---- locations picker (only for the trip's city) ----
  const [locationsOptions, setLocationsOptions] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [selectedLocationOption, setSelectedLocationOption] = useState(null);
  const [addingLocation, setAddingLocation] = useState(false);
  const [addLocationMessage, setAddLocationMessage] = useState(null);

  // Primary color handling (read from CSS var --primary-color or fallback to old blue)
  const [primaryColor, setPrimaryColor] = useState("#FF7485"); // fallback
  const [primaryLight, setPrimaryLight] = useState("#FF7485");
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
    try {
      const cssVal =
        getComputedStyle(document.documentElement).getPropertyValue(
          "--primary-color"
        ) || "";
      const prim = cssVal.trim() || "#FF7485";
      const light = lightenHex(prim, 0.28);
      setPrimaryColor(prim);
      setPrimaryLight(light);
      setPrimaryRgb(hexToRgb(light));
    } catch (e) {
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

  // helper: map a flight-offer / raw offer into the shape we feed into TripFlightSummary
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
      (itinerary && itinerary.duration) || firstSeg?.duration || "";
    const price = offer?.price?.total
      ? `${offer.price.total} ${offer.price.currency || ""}`
      : offer?.meta?.price || "";

    const canonicalId =
      flightCode || offer?.id || offer?.raw?.id || `offer_${idx}`;

    return {
      value: canonicalId,
      label: `${flightCode ? flightCode + "" : ""}${airline || offer.label || ""
        }${price ? ` · ${price}` : ""}`,
      meta: { times, flightCode, airline, duration, price },
      raw: offer,
    };
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

  // utility: refresh backend flight association and enrich it via flightsApi
  async function refreshBackendFlight() {
    setLoadingFlight(true);
    try {
      const flightsList = await apiGet(
        `/flights?trip_id=${encodeURIComponent(tripId)}`
      ).catch(() => null);

      const first =
        flightsList &&
          Array.isArray(flightsList.flights) &&
          flightsList.flights.length
          ? flightsList.flights[0]
          : null;

      if (first) {
        setBackendFlight(first);

        if (typeof flightsApi.getOfferById === "function") {
          try {
            const rawOffer = await flightsApi.getOfferById(
              String(first.flight_id)
            );
            if (rawOffer) {
              const mapped = mapOfferToSelectOption(rawOffer);
              setBackendFlightDetails(mapped);
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
      console.warn("Error refreshing flight for trip:", err);
      setFlightMessage(t("tripItinerary.refreshError"));
    } finally {
      setLoadingFlight(false);
      window.setTimeout(() => setFlightMessage(null), 3000);
    }
  }

  // load trip
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!Number.isFinite(tripId) || tripId <= 0) {
        setError(t("tripItinerary.invalidTripId"));
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const tripRes = await apiGet(`/trips/${tripId}`);
        if (!mounted) return;

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

        // refresh flight association (if any)
        try {
          await refreshBackendFlight();
        } catch (err) {
          console.warn("Error checking flights for trip:", err);
        }

        // no more destination-airport prefetch here; FlightFinder handles that internally
      } catch (err) {
        console.error("TripItinerary load error:", err);
        setError(t("tripItinerary.loadTripError"));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /**
   * Fetch locations by country and filter to the trip city.
   * Removes any locations already in the current trip.
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
        return !existingIds.has(Number(item.id));
      });

      const opts = filtered.map((r) => ({
        value: Number(r.id),
        label: `${r.title || t("tripItinerary.noTitle")}${r.city ? ` — ${r.city}` : ""
          }`,
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

  // when trip loads, set up city-locations select
  useEffect(() => {
    if (!trip) return;

    const dest = trip.destination || "";
    const parsed = parseCityCountryFromString(dest);
    const city = parsed.cityName || "";
    const country = parsed.countryName || dest || "";

    if (country) {
      fetchLocationsForCountry(country, city);
    } else if (dest) {
      fetchLocationsForCountry(dest, city);
    } else {
      setLocationsOptions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip]);

  const handleAddLocationToItinerary = async () => {
    if (!selectedLocationOption) {
      setAddLocationMessage(t("tripItinerary.selectPlaceFirst"));
      return;
    }
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
        },
      };
      await apiPost(`/trips/${tripId}/places/auto`, payload);
      const fresh = await apiGet(`/trips/${tripId}`);
      setTrip(fresh);
      setSelectedLocationOption(null);
      setAddLocationMessage(t("tripItinerary.placeAdded"));
    } catch (err) {
      console.error("handleAddLocationToItinerary", err);
      const msg =
        err && (err.message || (err.body && err.body.message))
          ? err.message || err.body.message
          : t("tripItinerary.addPlaceError");
      setAddLocationMessage(String(msg));
    } finally {
      setAddingLocation(false);
      window.setTimeout(() => setAddLocationMessage(null), 3500);
    }
  };

  const handleRemoveFlight = async () => {
    const fid = backendFlight?.flight_id || backendFlight?.flightId;
    if (!fid) return;
    if (!window.confirm(t("tripItinerary.removeFlightConfirm"))) return;
    try {
      await apiPut(`/flights/${encodeURIComponent(String(fid))}`, {
        trip_id: null,
      });
      setFlightMessage(t("tripItinerary.flightDisassociated"));
      setBackendFlight(null);
      setBackendFlightDetails(null);
      const fresh = await apiGet(`/trips/${tripId}`);
      setTrip(fresh);
    } catch (err) {
      console.error("disassociate error", err);
      setFlightMessage(t("tripItinerary.disassociateFlightError"));
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
    ev.stopPropagation();
    setMenuOpen((prev) => (prev === placeId ? null : placeId));
  };

  // Re-filter current locationsOptions whenever trip.places changes
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
    const filtered = locationsOptions.filter(
      (opt) => !existingIds.has(Number(opt.value))
    );
    if (filtered.length !== locationsOptions.length) {
      setLocationsOptions(filtered);
      if (
        selectedLocationOption &&
        existingIds.has(Number(selectedLocationOption.value))
      ) {
        setSelectedLocationOption(null);
      }
    }
  }, [trip?.places]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeletePlace = async (ev, place) => {
    ev.stopPropagation();
    if (!place || !place.id) return;
    const ok = window.confirm(
      t("tripItinerary.deletePlaceConfirm", {
        placeTitle: place.title || place.location?.titulo || "",
      })
    );
    if (!ok) {
      setMenuOpen(null);
      return;
    }
    try {
      await apiDelete(`/trips/${tripId}/places/${place.id}`);
      const fresh = await apiGet(`/trips/${tripId}`);
      setTrip(fresh);
      setMenuOpen(null);
    } catch (err) {
      console.error("Error eliminando punto:", err);
      alert(t("tripItinerary.deletePlaceError"));
    }
  };

  // group places by date & helper
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

    const { center, zoom } = computeCenterAndZoom(coords);
    setViewState((v) => ({
      ...v,
      latitude: center.latitude,
      longitude: center.longitude,
      zoom,
    }));
  };

  // lazy-load popup image
  useEffect(() => {
    let imgObj = null;
    if (
      !selectedLocationOnMap ||
      !selectedLocationOnMap.imageUrl ||
      !selectedLocationOnMap.loadImage
    )
      return undefined;

    const url = selectedLocationOnMap.imageUrl;
    imgObj = new Image();
    imgObj.src = url;
    imgObj.onload = () => {
      setSelectedLocationOnMap((prev) => {
        if (!prev) return prev;
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

  if (loading) {
    return (
      <div className="trip-it-root" style={{ backgroundColor: "white" }}>
        <LoadingSpinner message={t("tripItinerary.loading")} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="trip-it-root">
        <main className="trip-it-main">
          <div style={{ padding: 24 }}>
            <button className="back-link" onClick={() => navigate("/trips")}>
              {t("tripItinerary.backToTrips")}
            </button>
            <div style={{ marginTop: 18, color: "#b00020" }}>{error}</div>
          </div>
        </main>
      </div>
    );
  }

  if (!trip) {
    return <div className="trip-it-root" />;
  }

  // summary object for TripFlightSummary (if we have enriched details)
  const backendFlightSummary =
    backendFlightDetails &&
    buildSummaryFromBackendDetails(backendFlightDetails, {
      title: t("tripItinerary.flight"),
    });

  // ---------- Flight card ----------
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
        <h3 style={{ margin: 0, fontSize: 18 }}>
          {t("tripItinerary.flight")}
        </h3>
        <div style={{ color: "#666", fontSize: 13 }}>
          {displayTripDestination}
        </div>
      </div>
      {backendFlight ? (
        <div>
          {backendFlightSummary ? (
            <TripFlightSummary
              summary={backendFlightSummary}
              onRefresh={refreshBackendFlight}
              onRemove={handleRemoveFlight}
            />
          ) : (
            <div style={{ color: "#444", marginTop: 4 }}>
              {/* Fallback if we couldn't enrich from AeroDataBox */}
              <div style={{ fontWeight: 600 }}>
                {backendFlight.flight_id || t("tripItinerary.flight")}
              </div>
              {backendFlight.created_at && (
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  {t("tripItinerary.savedOn")} {fmtDate(backendFlight.created_at)}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 6 }}>
          <FlightFinderItinerary
            t={t}
            tripId={tripId}
            trip={trip}
            tripStartIso={tripStartIso}
            destination={trip.destination}
            onFlightSaved={refreshBackendFlight}
          />
        </div>
      )}
      {flightMessage && (
        <div style={{ marginTop: 10, color: "#333" }}>{flightMessage}</div>
      )}
    </section>
  );

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
          {t("tripItinerary.addCityPlaces")}
        </h3>
        <div style={{ color: "#666", fontSize: 13 }}>
          {displayTripDestination}
        </div>
      </div>

      <div style={{ marginTop: 6 }}>
        <div style={{ marginBottom: 8, fontSize: 13, color: "#444" }}>
          {t("tripItinerary.selectPlaceFromCity")}
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
              ? t("tripItinerary.loadingPlaces")
              : locationsOptions.length === 0
                ? t("home.noPlacesToShow")
                : t("tripItinerary.selectPlace")
          }
          isClearable
          onFocus={() => {
            const parsed = parseCityCountryFromString(trip.destination || "");
            const country = parsed.countryName || trip.destination || "";
            const city = parsed.cityName || "";
            fetchLocationsForCountry(country, city);
          }}
          noOptionsMessage={() =>
            locationsLoading
              ? t("tripItinerary.loadingPlaces")
              : t("tripItinerary.noPlacesInCity")
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
          disabled={addingLocation || !selectedLocationOption || isReadOnly}
        >
          {addingLocation
            ? t("tripItinerary.adding")
            : t("tripItinerary.addToItinerary")}
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
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          {image ? (
            <img
              src={image}
              alt={t("tripItinerary.place")}
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
              {t("tripItinerary.noImage")}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 22 }}>
              {loc.titulo ?? p.title ?? `Lugar #${p.fk_location}`}
            </h2>
            <div style={{ color: "#666", marginTop: 6 }}>
              {fmtDate(p.date)}{" "}
              {p.start_hour
                ? `· ${String(p.start_hour).slice(0, 5)}${p.end_hour
                  ? ` — ${String(p.end_hour).slice(0, 5)}`
                  : ""
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
                  {t("tripItinerary.viewSite")}
                </a>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: "1rem", flex: 1 }}>
          <h4 style={{ margin: "0 0 0.5rem 0" }}>
            {t("tripItinerary.notes")}
          </h4>
          <div style={{ color: "#333", lineHeight: 1.5 }}>
            {p.notes || "-"}
          </div>

          <div style={{ marginTop: "1.125rem" }}>
            <h4 style={{ margin: "0 0 8px 0" }}>
              {t("tripItinerary.location")}
            </h4>
            <div style={{ color: "#333" }}>
              {loc.titulo || loc.address || t("tripItinerary.noAddress")}
            </div>
            {Number.isFinite(Number(loc.latitude)) &&
              Number.isFinite(Number(loc.longitude)) && (
                <div style={{ marginTop: 10 }}>
                  <button
                    className="btn-secondary"
                    style={{ marginTop: 15 }}
                    onClick={() => {
                      setViewState((v) => ({
                        ...v,
                        latitude: Number(loc.latitude ?? loc.latitud),
                        longitude: Number(loc.longitude ?? loc.longitud),
                        zoom: 16,
                      }));
                    }}
                  >
                    {t("tripItinerary.viewOnMap")}
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
            {t("tripItinerary.edit")}
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              if (window.confirm(t("tripItinerary.deleteConfirm")))
                apiDelete(`/trips/${tripId}/places/${p.id}`).then(() =>
                  apiGet(`/trips/${tripId}`).then(setTrip)
                );
            }}
          >
            {t("tripItinerary.delete")}
          </button>
        </div>
      </div>
    );
  };

  const { groups: groupedPlaces, keys: groupKeys } = groupPlacesByDate(
    trip.places || []
  );

  // Determine trip status
  const tripStatus = getTripStatus(trip.start_date, trip.end_date);
  const isPast = isTripPast(trip.end_date);
  const isReadOnly = isPast; // Disable editing for past trips

  return (
    <div className="trip-it-root">
      <main className="trip-it-main">
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
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <h2 style={{ marginTop: 8, marginBottom: 4 }}>
                  {displayTripDestination}
                </h2>
                {isPast && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      backgroundColor: "#E8F5E9",
                      padding: "6px 12px",
                      borderRadius: "16px",
                      marginTop: "8px",
                    }}
                  >
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#2E7D32" }}>
                      {t("tripItinerary.completedTrip") || "Viaje Completado"}
                    </span>
                  </div>
                )}
              </div>
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
              <div style={{ color: "#888", fontSize: 13 }}>
                {t("tripItinerary.created")}
              </div>
              <div style={{ fontWeight: 700 }}>
                {fmtDate(trip.created_at)}
              </div>
            </div>
          </div>

          <section style={{ overflowY: "auto", paddingRight: 20 }}>
            {/* Flight card */}
            {flightCard}

            {/* Add location from city card */}
            {addLocationCard}

            <h3 style={{ marginTop: 18, marginBottom: 8 }}>
              {t("tripItinerary.itineraryByDay")}
            </h3>

            <div style={{ marginTop: 8 }}>
              {groupKeys.length === 0 ? (
                <div className="muted">
                  {t("tripItinerary.noPointsInItinerary")}
                </div>
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
                          <div
                            style={{ fontWeight: 700, fontSize: 15 }}
                          >
                            {dateKey === "no-date"
                              ? t("tripItinerary.dateNotSpecified")
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
                            {dayPlaces.length}{" "}
                            {dayPlaces.length > 1
                              ? t("tripItinerary.points")
                              : t("tripItinerary.point")}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          {hasCoords && (
                            <button
                              className={`btn-outline ${isActive ? "active" : ""
                                }`}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                showRouteForDate(dateKey, groupedPlaces);
                              }}
                              title={
                                isActive
                                  ? t("tripItinerary.hideRoute")
                                  : t("tripItinerary.showRoute")
                              }
                            >
                              <FaMapMarkedAlt
                                size={16}
                                style={{ marginRight: 8 }}
                              />
                              <span style={{ fontSize: 13 }}>
                                {isActive
                                  ? t("tripItinerary.hideRoute")
                                  : t("tripItinerary.showRoute")}
                              </span>
                            </button>
                          )}

                          <button
                            className="btn-small"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              navigate(
                                `/add_place/${tripId}?date=${dateKey}`
                              );
                            }}
                            title={t("tripItinerary.addPointToDay")}
                          >
                            + {t("tripItinerary.add")}
                          </button>
                        </div>
                      </div>

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
                                    style={{
                                      fontSize: 15,
                                      fontWeight: 600,
                                    }}
                                  >
                                    {p.title ??
                                      p.location?.titulo ??
                                      t("tripItinerary.activity")}
                                  </div>
                                  {p.notes && (
                                    <div
                                      style={{
                                        fontSize: 13,
                                        color: "#444",
                                      }}
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
                                        {t("tripItinerary.viewSite")}
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
                                    if (
                                      selectedLocationOnMap?.place?.id === p.id
                                    ) {
                                      setSelectedLocationOnMap(null);
                                      setClickOnMap(false);
                                    } else {
                                      const imageUrl =
                                        (loc.imagenes &&
                                          loc.imagenes[0]) ||
                                        (loc.images && loc.images[0]) ||
                                        (p.images && p.images[0]) ||
                                        null;
                                      setSelectedLocationOnMap({
                                        latitude: lat,
                                        longitude: lng,
                                        place: p,
                                        titulo: loc.titulo ?? p.title,
                                        image: null,
                                        imageUrl: imageUrl,
                                        loadImage: !!imageUrl,
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
                                    background:
                                      selectedLocationOnMap &&
                                        selectedLocationOnMap.place?.id === p.id
                                        ? "#ff3951"
                                        : "#fff",
                                    border: "1px solid #eee",
                                    cursor: "pointer",
                                  }}
                                  className="place-icon"
                                >
                                  <svg
                                    width="18"
                                    height="18"
                                    viewBox="0 0 24 24"
                                    fill={
                                      selectedLocationOnMap &&
                                        selectedLocationOnMap.place?.id === p.id
                                        ? "#fff"
                                        : "#ff3951"
                                    }
                                  >
                                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"></path>
                                  </svg>
                                </div>

                                <div
                                  className="trip-it-menu-wrapper"
                                  style={{ position: "relative" }}
                                  ref={menuContainerRef}
                                >
                                  <button
                                    className="trip-it-menu-btn"
                                    onClick={(ev) =>
                                      togglePlaceMenu(ev, p.id)
                                    }
                                    aria-haspopup="true"
                                    aria-expanded={menuOpen === p.id}
                                  >
                                    ⋮
                                  </button>

                                  {menuOpen === p.id && (
                                    <div
                                      className="trip-it-menu"
                                      onClick={(e) => e.stopPropagation()}
                                      style={{
                                        position:
                                          "absolute",
                                        top: "calc(100% + 0.375rem)",
                                        right: 0,
                                        zIndex: 30,
                                      }}
                                    >
                                      <IconButton
                                        icon={<FaEdit size={18} />}
                                        onClick={(ev) => {
                                          ev.stopPropagation();
                                          navigate(
                                            `/edit-place/${trip.id}?placeIndex=${(
                                              trip.places || []
                                            ).findIndex(
                                              (pp) => pp.id === p.id
                                            )}`
                                          );
                                          setMenuOpen(null);
                                        }}
                                        title={t(
                                          "tripItinerary.editPoint"
                                        )}
                                        variant="menu"
                                      />

                                      <IconButton
                                        icon={<FaTrash size={18} />}
                                        onClick={(ev) =>
                                          handleDeletePlace(ev, p)
                                        }
                                        title={t(
                                          "tripItinerary.deletePoint"
                                        )}
                                        variant="menu"
                                      />
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
                {t("tripItinerary.addToItineraryButton")}
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
                          typeof e.nativeEvent
                            .stopImmediatePropagation === "function"
                        )
                          e.nativeEvent.stopImmediatePropagation();
                      } catch (e) { }
                      e.stopPropagation();
                      if (
                        !Number.isFinite(Number(m.latitude)) ||
                        !Number.isFinite(Number(m.longitude))
                      )
                        return;
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
                          typeof e.nativeEvent
                            .stopImmediatePropagation === "function"
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
                      setClickOnMap(!clickOnMap);
                      const img =
                        m.images && m.images.length ? m.images[0] : null;
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
                      {selectedLocationOnMap.imageLoading ? (
                        <div
                          style={{
                            width: "3.125rem",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <div className="img-spinner" />
                        </div>
                      ) : (
                        selectedLocationOnMap.imageUrl && (
                          <div className="img-popup-container">
                            <img
                              src={selectedLocationOnMap.imageUrl}
                              className="img-popUp"
                              alt={t("tripItinerary.currentPlace")}
                            />
                          </div>
                        )
                      )}

                      <div
                        className="place-info"
                        style={{ paddingTop: 8 }}
                      >
                        <h3>{selectedLocationOnMap.titulo}</h3>
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
                            {String(
                              selectedLocationOnMap.place.end_hour
                            ).slice(0, 5)}
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
