// src/pages/Explore.js
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/explore.css";
import { apiGet, apiPost } from "./api";
import OptimizedImage from "../components/OptimizedImage";
import { useTranslation } from "../i18n";
import Modal from "../components/Modal";
import WideModal from "../components/WideModal";
import ActionButton from "../components/ActionButton";
import LoadingSpinner from "../components/LoadingSpinner";
import FilterSelect from "../components/FilterSelect";
import { translateCategory } from "../helpers/categoryTranslations";
import {
  FaTheaterMasks,
  FaTree,
  FaUtensils,
  FaShoppingBag,
  FaBirthdayCake,
  FaFutbol,
  FaOm,
  FaUsers,
  FaGlobe,
  FaMapMarkerAlt,
} from "react-icons/fa";

// ✅ use the same mapbox entrypoint/style you already use
import Map, { Marker, NavigationControl, Popup } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || "";

/**
 * Normaliza muchas formas distintas de `imagenes` a un array de URLs de string.
 */
const safeParseImages = (im) => {
  if (!im) return [];
  if (Array.isArray(im))
    return im.map((it) =>
      typeof it === "object" && it !== null && it.url ? it.url : it
    );
  if (typeof im === "string") {
    try {
      const parsed = JSON.parse(im);
      if (Array.isArray(parsed))
        return parsed.map((it) =>
          typeof it === "object" && it !== null && it.url ? it.url : it
        );
      return [parsed];
    } catch (e) {
      if (im.includes(",")) return im.split(",").map((s) => s.trim());
      return [im];
    }
  }
  if (typeof im === "object" && im !== null) {
    if (Array.isArray(im.urls)) return im.urls;
    if (im.url) return [im.url];
  }
  return [];
};

// map slug -> React icon
const categoryIcons = {
  cultura: FaTheaterMasks,
  naturaleza: FaTree,
  gastronomia: FaUtensils,
  compras: FaShoppingBag,
  fiestas: FaBirthdayCake,
  deportes: FaFutbol,
  relax: FaOm,
  familia: FaUsers,
};

function sortByRelevanceDesc(arr) {
  if (!Array.isArray(arr)) return [];
  const getRel = (x) => {
    const v = x?.relevance ?? x?.relevancia ?? 0;
    return Number(v) || 0;
  };
  return [...arr].sort((a, b) => getRel(b) - getRel(a));
}

/**
 * Elige la mejor imagen candidata.
 */
const pickBestImage = (imgs = []) => {
  if (!Array.isArray(imgs) || imgs.length === 0) return null;
  const urls = imgs
    .filter(Boolean)
    .map((u) => (typeof u === "string" ? u : String(u)));
  const thumb = urls.find((u) => u.includes("/thumb/"));
  if (thumb) return thumb;
  const smallPx = urls.find((u) => /\/\d+px-/.test(u));
  if (smallPx) return smallPx;
  if (urls[1]) return urls[1];
  return urls[0] || null;
};

const wikimediaSrcSet = (thumbUrl, widths = [320, 640, 1024]) => {
  if (!thumbUrl || typeof thumbUrl !== "string") return null;
  if (!thumbUrl.includes("/thumb/")) return null;
  const match = thumbUrl.match(/(\/)(\d+)px-/);
  if (!match) return null;
  return widths
    .map((w) => {
      const s = thumbUrl.replace(/\/\d+px-/, `/${w}px-`);
      return `${s} ${w}w`;
    })
    .join(", ");
};

const defaultModalSizes = "(max-width: 900px) 100vw, 900px";

/** Simple star row like "★★★★☆" */
function renderStars(rating) {
  const n = Math.max(0, Math.min(5, Math.round(Number(rating || 0))));
  const full = "★".repeat(n);
  const empty = "☆".repeat(5 - n);
  return full + empty;
}

function getTripId(trip) {
  if (!trip) return null;
  const id = trip.id ?? trip.trip_id ?? trip.tripId;
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function safeParsePlaces(places) {
  if (!places) return [];
  if (Array.isArray(places)) return places;
  if (typeof places === "string") {
    try {
      const parsed = JSON.parse(places);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function extractLocationIdFromTripPlace(p) {
  // based on your payload: p.fk_location and p.location.id
  const a = p?.fk_location;
  const b = p?.location?.id;
  const n = Number(a ?? b);
  return Number.isFinite(n) ? n : null;
}

function normStr(s) {
  return (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parseDestinationCityCountry(destination) {
  const d = (destination ?? "").toString().trim();
  if (!d) return { city: null, country: null };

  const parts = d.split(",").map((p) => p.trim()).filter(Boolean);

  // "Berlin, Germany" -> city="Berlin", country="Germany"
  if (parts.length >= 2) {
    return {
      city: parts.slice(0, parts.length - 1).join(", "),
      country: parts[parts.length - 1],
    };
  }

  // Single token like "Berlin" or "Germany" (unknown which)
  return { city: d, country: null };
}

function buildDestinationForCreate(exp) {
  const city = exp?.raw?.city?.toString().trim();
  const country = exp?.raw?.country?.toString().trim();
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (country) return country;
  return exp?.title ?? "";
}

export default function Explore() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // server-driven
  const [categories, setCategories] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [userTrips, setUserTrips] = useState([]);

  // UI & state
  const [initialLoading, setInitialLoading] = useState(true);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [error, setError] = useState(null);

  // categoría elegida (slug de interests)
  const [selectedCategorySlug, setSelectedCategorySlug] = useState("todo");
  const [selectedCategoryTitle, setSelectedCategoryTitle] = useState("Todo");

  // filtros de lugares (NO de viaje)
  const [filterCountry, setFilterCountry] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [sortBy, setSortBy] = useState("relevance"); // 'relevance' | 'name'

  // modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedExperience, setSelectedExperience] = useState(null);

  // google reviews state
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState(null);
  const [googleData, setGoogleData] = useState(null);

  // trip places
  const [tripPlacesLoading, setTripPlacesLoading] = useState(false);
  const [tripPlacesError, setTripPlacesError] = useState(null);
  const [tripPlaceLocationIds, setTripPlaceLocationIds] = useState(new Set());

  // add-to-trip state
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState(null);

  // --- "Add location" modal state
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [createLocLoading, setCreateLocLoading] = useState(false);
  const [createLocError, setCreateLocError] = useState(null);

  const [newLoc, setNewLoc] = useState({
    titulo: "",
    fk_interest: "", // category id
    descripcion: "",
    country: "",
    city: "",
    latitude: "",
    longitude: "",
    relevancia: "",
    website: "",
    opening_hours_raw: "",
    imagenes_raw: "", // comma-separated URLs
  });

  // ✅ MAP PICKER (like your Map.jsx)
  // pickerPos uses [lat, lng]
  const [pickerPos, setPickerPos] = useState([-34.6037, -58.3816]); // BA default
  const [createMapViewState, setCreateMapViewState] = useState({
    longitude: -58.3816,
    latitude: -34.6037,
    zoom: 2,
    pitch: 0,
    bearing: 0,
  });

  // Keep fk_interest default in sync once categories load
  useEffect(() => {
    if (!newLoc.fk_interest && Array.isArray(categories) && categories.length > 0) {
      setNewLoc((p) => ({ ...p, fk_interest: String(categories[0].id) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  // ✅ when opening add modal: sync map with existing coords and/or try geolocation
useEffect(() => {
  if (!showAddLocationModal) return;

  const latStr = (newLoc.latitude ?? "").toString().trim();
  const lngStr = (newLoc.longitude ?? "").toString().trim();

  const lat = latStr !== "" ? Number(latStr) : NaN;
  const lng = lngStr !== "" ? Number(lngStr) : NaN;

  const isValid =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180;

  if (isValid) {
    setPickerPos([lat, lng]);
    setCreateMapViewState((v) => ({
      ...v,
      latitude: lat,
      longitude: lng,
      zoom: Math.max(v.zoom || 2, 14),
      pitch: v.pitch || 0,
      bearing: v.bearing || 0,
    }));
    return;
  }

  // fallback: geolocation...
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const glat = pos.coords.latitude;
        const glng = pos.coords.longitude;
        if (Number.isFinite(glat) && Number.isFinite(glng)) {
          setPickerPos([glat, glng]);
          setCreateMapViewState((v) => ({
            ...v,
            latitude: glat,
            longitude: glng,
            zoom: 13,
            pitch: v.pitch || 0,
            bearing: v.bearing || 0,
          }));
          setNewLoc((p) => ({
            ...p,
            latitude: p.latitude || String(glat),
            longitude: p.longitude || String(glng),
          }));
        }
      },
      () => { /* ignore */ }
    );
  }
}, [showAddLocationModal]);

  const setCoordsFromPicker = (lat, lng) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    setPickerPos([lat, lng]); // [lat, lng]
    setNewLoc((p) => ({
      ...p,
      latitude: String(lat),
      longitude: String(lng),
    }));
  };

  function parseImagesRaw(str) {
    const s = (str || "").trim();
    if (!s) return null;

    // allow JSON array paste
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const parsed = JSON.parse(s);
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        // fallthrough to comma parsing
      }
    }

    const arr = s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    return arr.length ? arr : null;
  }

  async function submitNewLocation(e) {
    e?.preventDefault?.();
    setCreateLocError(null);

    // Basic required fields (backend requires titulo + fk_interest)
    if (!newLoc.titulo.trim() || !newLoc.fk_interest) {
      setCreateLocError("Completá el nombre del lugar y una categoría.");
      return;
    }

    const payload = {
      titulo: newLoc.titulo.trim(),
      fk_interest: Number(newLoc.fk_interest),
      descripcion: newLoc.descripcion?.trim() || null,
      country: newLoc.country?.trim() || null,
      city: newLoc.city?.trim() || null,
      latitude: newLoc.latitude !== "" ? Number(newLoc.latitude) : null,
      longitude: newLoc.longitude !== "" ? Number(newLoc.longitude) : null,
      relevancia: "0",
      website: newLoc.website?.trim() || null,

      // store as { raw: "Mo-Sa ..." } to match what your UI expects
      opening_hours: newLoc.opening_hours_raw?.trim()
        ? { raw: newLoc.opening_hours_raw.trim() }
        : null,

      imagenes: parseImagesRaw(newLoc.imagenes_raw),
    };

    setCreateLocLoading(true);
    try {
      const res = await apiPost("/locations", payload); // must be authenticated (auth middleware)
      const created = res?.location || res?.data?.location;

      if (created) {
        // update UI list immediately
        setAllLocations((prev) => sortByRelevanceDesc([created, ...(prev || [])]));
      }

      setShowAddLocationModal(false);
      setNewLoc({
        titulo: "",
        fk_interest: String(categories?.[0]?.id || ""),
        descripcion: "",
        country: "",
        city: "",
        latitude: "",
        longitude: "",
        relevancia: "",
        website: "",
        opening_hours_raw: "",
        imagenes_raw: "",
      });

      // reset map picker
      setPickerPos([-34.6037, -58.3816]);
      setCreateMapViewState({
        longitude: -58.3816,
        latitude: -34.6037,
        zoom: 12,
        pitch: 0,
        bearing: 0,
      });
    } catch (err) {
      console.error("POST /locations error:", err);
      setCreateLocError(err?.message || "No se pudo crear el lugar.");
    } finally {
      setCreateLocLoading(false);
    }
  }

  const scrollRoot =
    typeof document !== "undefined"
      ? document.querySelector(".explorar-main")
      : null;

  // ---- helpers de mapeo location -> "experience" para la UI
  const mapToExperiences = (locs) => {
    if (!Array.isArray(locs)) return [];
    return locs.map((loc) => {
      const imgs = safeParseImages(loc.images ?? loc.imagenes);
      const chosen = pickBestImage(imgs);
      const imageSrcSet = chosen ? wikimediaSrcSet(chosen, [320, 640, 1024]) : null;

      let imageLarge = null;
      if (chosen && chosen.includes("/thumb/") && chosen.match(/\/\d+px-/)) {
        imageLarge = chosen.replace(/\/\d+px-/, "/1024px-");
      } else if (imgs && imgs.length) {
        imageLarge = imgs[0];
      }

      const rawTitle =
        loc.title ?? loc.titulo ?? loc.name ?? `Lugar #${loc.id ?? "?"}`;
      const rawDescription = loc.description ?? loc.descripcion ?? "";
      const truncated =
        rawDescription && rawDescription.length > 150
          ? rawDescription.slice(0, 150) + "…"
          : rawDescription;

      return {
        id: loc.id,
        title: rawTitle,
        description: truncated,
        category: loc.interest ?? loc.fk_interest ?? null,
        image: chosen,
        imageSrcSet,
        imageLarge,
        raw: loc,
      };
    });
  };

  // ------- carga inicial: categorías, locations y trips
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setError(null);
      try {
        const [catsRes, locsRes] = await Promise.all([
          apiGet("/interests"),
          apiGet("/locations?limit=400"),
        ]);

        if (!mounted) return;

        const cats = Array.isArray(catsRes) ? catsRes : [];
        setCategories(cats);

        const locArray = Array.isArray(locsRes) ? locsRes : locsRes?.rows || [];
        const sorted = sortByRelevanceDesc(locArray);
        setAllLocations(sorted);

        setInitialLoading(false);
        setLocationsLoading(false);
      } catch (err) {
        console.error("Initial load Explore error:", err);
        if (!mounted) return;
        setError("No se pudieron cargar los lugares.");
        setInitialLoading(false);
        setLocationsLoading(false);
      }

      try {
        const tripsRes = await apiGet("/trips");
        if (!mounted) return;
        const tripsArr = Array.isArray(tripsRes) ? tripsRes : tripsRes?.rows || [];
        setUserTrips(tripsArr);
      } catch (err) {
        console.error("Trips fetch error:", err);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // ---- experiencias globales (todas, ordenadas por relevancia)
  const worldwideExperiences = useMemo(() => mapToExperiences(allLocations), [allLocations]);

  // ---- sección "Populares mundialmente"
  const popularExperiences = useMemo(() => worldwideExperiences.slice(0, 12), [worldwideExperiences]);

  // ---- determinar viaje de contexto (activo o más cercano en el tiempo)
  const tripContext = useMemo(() => {
    if (!userTrips || userTrips.length === 0) return null;

    const parseDate = (d) => (d ? new Date(d) : null);
    const today = new Date();

    const tripsWithDates = userTrips.map((t) => ({
      ...t,
      start: parseDate(t.start_date || t.startDate),
      end: parseDate(t.end_date || t.endDate),
    }));

    const active = tripsWithDates.filter(
      (t) => t.start && t.end && t.start <= today && t.end >= today
    );
    if (active.length > 0) {
      active.sort((a, b) => a.end - b.end);
      return active[0];
    }

    tripsWithDates.sort((a, b) => {
      const refA = tRefDate(a, today);
      const refB = tRefDate(b, today);
      return Math.abs(refA - today) - Math.abs(refB - today);
    });

    return tripsWithDates[0] || null;
  }, [userTrips]);

  function tRefDate(t, today) {
    if (t.start) return t.start;
    if (t.end) return t.end;
    return today;
  }

  // ---- mapear destino del viaje a un país de locations
  const tripCountry = useMemo(() => {
    if (!tripContext) return null;

    // ✅ best source: parse "City, Country"
    const destParts = parseDestinationCityCountry(tripContext.destination);
    const countryFromDest = (destParts.country || "").trim();
    if (countryFromDest) return countryFromDest;

    // fallback: previous heuristic (only if destination has no country)
    if (!allLocations.length) return null;
    const destination = (tripContext.destination || "").trim();
    if (!destination) return null;

    const destLower = destination.toLowerCase();

    const countries = Array.from(
      new Set(allLocations.map((l) => (l.country || "").trim()).filter(Boolean))
    );

    let found = countries.find((c) => c.toLowerCase() === destLower);
    if (found) return found;

    const locByCity = allLocations.find(
      (loc) => (loc.city || "").toLowerCase() === destLower
    );
    if (locByCity && locByCity.country) return locByCity.country;

    found = countries.find((c) => {
      const lc = c.toLowerCase();
      return lc.includes(destLower) || destLower.includes(lc);
    });

    return found || null;
  }, [tripContext, allLocations]);

  const tripContextTitle = useMemo(() => {
    if (!tripContext) return null;
    return tripContext.destination || tripCountry || null;
  }, [tripContext, tripCountry]);

  const tripDestParts = useMemo(() => {
    return parseDestinationCityCountry(tripContext?.destination);
  }, [tripContext?.destination]);

  const tripCity = tripDestParts.city;

  // NEW: fetch places from GET /trips/:id and build a Set of fk_location
  useEffect(() => {
    let alive = true;

    async function loadTripPlaces() {
      const tripId = getTripId(tripContext);

      if (!tripId) {
        setTripPlacesError(null);
        setTripPlaceLocationIds(new Set());
        return;
      }

      setTripPlacesLoading(true);
      setTripPlacesError(null);

      try {
        const trip = await apiGet(`/trips/${tripId}`);
        if (!alive) return;

        const placesArr = safeParsePlaces(trip?.places);
        const set = new Set(
          placesArr.map(extractLocationIdFromTripPlace).filter((x) => x !== null)
        );

        setTripPlaceLocationIds(set);
      } catch (err) {
        console.error("GET /trips/:id (places) error:", err);
        if (!alive) return;
        setTripPlacesError(err?.message || String(err));
        setTripPlaceLocationIds(new Set());
      } finally {
        if (alive) setTripPlacesLoading(false);
      }
    }

    loadTripPlaces();
    return () => {
      alive = false;
    };
  }, [tripContext?.id]);

  // ---- lugares para el país del viaje de contexto (hide already added)
  const tripExperiences = useMemo(() => {
    if (!tripCountry) return [];
    const locs = allLocations.filter(
      (loc) => (loc.country || "").toLowerCase() === tripCountry.toLowerCase()
    );

    const exps = mapToExperiences(locs);

    const filtered = exps.filter((exp) => {
      const locId = Number(exp?.id);
      if (!Number.isFinite(locId)) return true;
      return !tripPlaceLocationIds.has(locId);
    });

    return filtered.slice(0, 8);
  }, [tripCountry, allLocations, tripPlaceLocationIds]);

  // ---- opciones de país y ciudad para los filtros
  const countryOptions = useMemo(() => {
    const set = new Set();
    allLocations.forEach((loc) => {
      const c = (loc.country || "").trim();
      if (c) set.add(c);
    });
    const arr = Array.from(set).sort((a, b) => a.localeCompare(b));
    return [{ value: "", label: t("explore.any") }, ...arr.map((c) => ({ value: c, label: c }))];
  }, [allLocations, t]);

  const cityOptions = useMemo(() => {
    const set = new Set();
    allLocations.forEach((loc) => {
      const city = (loc.city || "").trim();
      if (!city) return;
      if (filterCountry && loc.country !== filterCountry) return;
      set.add(city);
    });
    const arr = Array.from(set).sort((a, b) => a.localeCompare(b));
    return [{ value: "", label: t("explore.any") }, ...arr.map((c) => ({ value: c, label: c }))];
  }, [allLocations, filterCountry, t]);

  const sortOptions = useMemo(
    () => [
      { value: "relevance", label: "Más relevantes" },
      { value: "name", label: "Nombre (A-Z)" },
    ],
    []
  );

  const selectedCategoryId = useMemo(() => {
    if (selectedCategorySlug === "todo") return null;

    const cat = categories.find(
      (c) => String(c.slug).toLowerCase() === String(selectedCategorySlug).toLowerCase()
    );

    return cat ? String(cat.id) : null;
  }, [categories, selectedCategorySlug]);

  // ---- aplicar filtros (categoría, país, ciudad, orden) al grid principal
  const filteredExperiences = useMemo(() => {
    let exps = worldwideExperiences;

    if (selectedCategorySlug !== "todo") {
      const wantedId = selectedCategoryId; // e.g. "1"
      exps = exps.filter((exp) => {
        const expInterestId =
          exp?.category ?? exp?.raw?.interest ?? exp?.raw?.fk_interest ?? null;

        return wantedId && String(expInterestId) === String(wantedId);
      });
    }

    if (filterCountry) {
      const cLower = filterCountry.toLowerCase();
      exps = exps.filter((exp) => (exp.raw?.country || "").toLowerCase() === cLower);
    }

    if (filterCity) {
      const cityLower = filterCity.toLowerCase();
      exps = exps.filter((exp) => (exp.raw?.city || "").toLowerCase() === cityLower);
    }

    if (sortBy === "name") {
      exps = [...exps].sort((a, b) => a.title.localeCompare(b.title));
    }

    return exps;
  }, [worldwideExperiences, selectedCategorySlug, selectedCategoryId, filterCountry, filterCity, sortBy]);

  // ---- callbacks UI
  const onCategoryClick = (category) => {
    if (category === "todo") {
      setSelectedCategorySlug("todo");
      setSelectedCategoryTitle(t("explore.all"));
      return;
    }
    const slug = category?.slug ?? String(category);
    const title = category?.title ?? category?.name ?? slug;
    const translatedTitle = translateCategory(t, slug, title);
    setSelectedCategorySlug(slug);
    setSelectedCategoryTitle(translatedTitle);
  };

  const handleExperienceClick = (experience) => {
    setSelectedExperience(experience);
    setAddError(null);
    setShowDetailModal(true);
  };

  // ✅ create trip navigation (used when not allowed to add to current trip)
  const goCreateTripFromSelected = () => {
    const destination = buildDestinationForCreate(selectedExperience);
    setAddError(null);
    setShowDetailModal(false);
    navigate("/add-trip", { state: { destination } });
  };

  // ✅ add to current trip (only called when allowed)
  const addSelectedToTrip = async () => {
    setAddError(null);

    const tripId = getTripId(tripContext);
    const locationId = Number(selectedExperience?.id);

    if (!tripId) {
      goCreateTripFromSelected();
      return;
    }

    if (!Number.isFinite(locationId)) {
      setAddError("No se pudo determinar el id del lugar.");
      return;
    }

    if (tripPlaceLocationIds.has(locationId)) {
      goCreateTripFromSelected();
      return;
    }

    setAddLoading(true);
    try {
      await apiPost(`/trips/${tripId}/places/auto`, {
        place: { fk_location: locationId },
      });

      setTripPlaceLocationIds((prev) => {
        const next = new Set(prev);
        next.add(locationId);
        return next;
      });

      setShowDetailModal(false);
    } catch (err) {
      console.error("POST /places/auto error:", err);
      setAddError(err?.message || String(err));
    } finally {
      setAddLoading(false);
    }
  };

  const handleShare = () => {
    if (!selectedExperience) return;
    if (navigator.share) {
      navigator
        .share({
          title: selectedExperience.title,
          text: selectedExperience.description,
          url: window.location.href,
        })
        .catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert(t("explore.linkCopied"));
    }
  };

  const clearFilters = () => {
    setSelectedCategorySlug("todo");
    setSelectedCategoryTitle("Todo");
    setFilterCountry("");
    setFilterCity("");
    setSortBy("relevance");
  };

  const removeActiveFilter = (type) => {
    if (type === "country") setFilterCountry("");
    if (type === "city") setFilterCity("");
    if (type === "sort") setSortBy("relevance");
  };

  // ---- skeleton mientras cargan locations
  const renderGridSkeleton = (count = 6) => {
    const arr = Array.from({ length: count }, (_, i) => i);
    return (
      <div className="experiences-grid">
        {arr.map((i) => (
          <div className="experience-card skeleton" key={`s-${i}`}>
            <div className="card-image">
              <div
                className="img-skeleton"
                style={{ height: 0, paddingBottom: `${(260 / 400) * 100}%` }}
              />
            </div>
            <div className="card-content">
              <div className="skeleton-line title" />
              <div className="skeleton-line desc" />
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ---- fetch Google rating + reviews when modal opens
  useEffect(() => {
    let alive = true;

    async function loadGoogle() {
      if (!showDetailModal || !selectedExperience) return;

      setGoogleError(null);
      setGoogleLoading(true);
      setGoogleData(null);

      try {
        const raw = selectedExperience.raw || {};
        const name = selectedExperience.title || "";
        const city = raw.city || "";
        const country = raw.country || "";

        const qs = new URLSearchParams({
          name,
          city,
          country,
          lang: "es",
        });

        const data = await apiGet(`/google/reviews?${qs.toString()}`);
        if (!alive) return;
        setGoogleData(data);
      } catch (e) {
        if (!alive) return;
        setGoogleError(e?.message || String(e));
        setGoogleData(null);
      } finally {
        if (alive) setGoogleLoading(false);
      }
    }

    loadGoogle();

    return () => {
      alive = false;
    };
  }, [showDetailModal, selectedExperience?.id]);

  // ---- bloqueamos solo mientras carga TODO por primera vez
  if (initialLoading) {
    return (
      <div className="explorar-page">
        <LoadingSpinner message={t("common.loading")} fullScreen />
      </div>
    );
  }

  const place = googleData?.place || null;
  const reviews = Array.isArray(googleData?.reviews) ? googleData.reviews : [];

  // --- compute whether we should show "Agregar al viaje" or "Crear viaje"
  const tripIdForAdd = getTripId(tripContext);

  const selectedLocId = Number(selectedExperience?.id);
  const isAlreadyInTrip =
    !!tripIdForAdd && Number.isFinite(selectedLocId) && tripPlaceLocationIds.has(selectedLocId);

  const selectedCountry = selectedExperience?.raw?.country || null;
  const selectedCity = selectedExperience?.raw?.city || null;

  const sameCountry =
    !!tripCountry && !!selectedCountry && normStr(tripCountry) === normStr(selectedCountry);

  const sameCity =
    !!tripCity && !!selectedCity && normStr(tripCity) === normStr(selectedCity);

  // Only show "Agregar al viaje" if it can truly be added to the current trip.
  const canAddToCurrentTrip =
    !!tripIdForAdd &&
    sameCity &&
    !isAlreadyInTrip &&
    (!tripCountry || sameCountry);

  const primaryCtaLabel = canAddToCurrentTrip
    ? "Agregar al viaje"
    : t("explore.createTripPlan");

  const primaryCtaOnClick = canAddToCurrentTrip ? addSelectedToTrip : goCreateTripFromSelected;

  // ---- render principal
  return (
    <div className="explorar-page">
      <main className="explorar-main">
        <div className="explorar-container">
          <div className="owner-bubble">
            <div className="owner-bubble-text">
              ¿Sos dueño/a o administrador/a de un lugar turístico? Publicalo en ComfTrip para que más viajeros lo encuentren.
            </div>
            <button
              className="owner-bubble-btn"
              onClick={() => {
                setCreateLocError(null);
                setShowAddLocationModal(true);
              }}
            >
              Agregar lugar
            </button>
          </div>

          {/* SECCIÓN VIAJE ACTUAL / MÁS CERCANO (hide already added) */}
          {tripContextTitle && tripCountry && (
            <div className="experiences-section">
              <div className="section-header">
                <h2>Lugares para tu viaje a {tripContextTitle}</h2>
              </div>

              {tripPlacesLoading ? (
                <div className="small-muted">Cargando lugares del viaje…</div>
              ) : tripPlacesError ? (
                <div className="small-muted" style={{ color: "#c33" }}>
                  No se pudieron cargar lugares del viaje: {tripPlacesError}
                </div>
              ) : locationsLoading ? (
                renderGridSkeleton(6)
              ) : tripExperiences.length === 0 ? (
                <div className="small-muted">
                  No hay recomendaciones nuevas para este viaje (o ya agregaste las más relevantes).
                </div>
              ) : (
                <div className="experiences-grid">
                  {tripExperiences.map((exp, idx) => (
                    <div
                      key={exp.id}
                      className="experience-card"
                      onClick={() => handleExperienceClick(exp)}
                    >
                      <div className="card-image">
                        {exp.image ? (
                          <OptimizedImage
                            src={exp.image}
                            alt={exp.title}
                            width={400}
                            height={260}
                            scrollRoot={scrollRoot}
                            priority={idx < 4}
                          />
                        ) : (
                          <div className="no-image">No image</div>
                        )}
                      </div>
                      <div className="card-content">
                        <h3 className="card-title">{exp.title}</h3>
                        <p className="card-description">{exp.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <h1 className="explorar-title">{t("explore.title")}</h1>

          {/* CATEGORÍAS */}
          <div className="categories-section">
            <div className="categories-grid">
              <div
                className={`category-card ${selectedCategorySlug === "todo" ? "active" : ""}`}
                onClick={() => onCategoryClick("todo")}
              >
                <div className="category-icon">
                  <FaGlobe />
                </div>
                <div className="category-name">{t("explore.all")}</div>
              </div>

              {categories.map((cat) => {
                const IconComponent = categoryIcons[cat.slug] || FaMapMarkerAlt;
                const slug = cat.slug ?? String(cat.id ?? "");
                const translatedTitle = translateCategory(t, slug, cat.title);
                return (
                  <div
                    key={cat.slug ?? cat.id}
                    className={`category-card ${selectedCategorySlug === cat.slug ? "active" : ""}`}
                    onClick={() => onCategoryClick(cat)}
                  >
                    <div className="category-icon">
                      <IconComponent />
                    </div>
                    <div className="category-name">{translatedTitle}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FILTROS LÓGICOS PARA LUGARES */}
          <div className="filters-section compact">
            <div className="filters-row">
              <div className="filter-field">
                <label>País</label>
                <FilterSelect
                  value={filterCountry}
                  onChange={(val) => {
                    setFilterCountry(val);
                    setFilterCity("");
                  }}
                  placeholder={t("explore.any")}
                  options={countryOptions}
                  isClearable={false}
                />
              </div>

              <div className="filter-field">
                <label>Ciudad</label>
                <FilterSelect
                  value={filterCity}
                  onChange={setFilterCity}
                  placeholder={t("explore.any")}
                  options={cityOptions}
                  isClearable={false}
                />
              </div>

              <div className="filter-field">
                <label>Ordenar por</label>
                <FilterSelect
                  value={sortBy}
                  onChange={setSortBy}
                  placeholder="Más relevantes"
                  options={sortOptions}
                  isClearable={false}
                />
              </div>

              <div className="filter-actions">
                <button className="btn-clear" onClick={clearFilters}>
                  {t("explore.clearFilters")}
                </button>
              </div>
            </div>

            {/* chips filtros activos */}
            <div className="active-chips">
              {filterCountry && (
                <div className="filter-chip">
                  País: {filterCountry}
                  <button className="chip-x" onClick={() => removeActiveFilter("country")}>
                    ✕
                  </button>
                </div>
              )}
              {filterCity && (
                <div className="filter-chip">
                  Ciudad: {filterCity}
                  <button className="chip-x" onClick={() => removeActiveFilter("city")}>
                    ✕
                  </button>
                </div>
              )}
              {sortBy !== "relevance" && (
                <div className="filter-chip">
                  Orden: {sortOptions.find((o) => o.value === sortBy)?.label}
                  <button className="chip-x" onClick={() => removeActiveFilter("sort")}>
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RESULTADOS PRINCIPALES */}
          <div className="experiences-section">
            <div className="section-header">
              <h2>
                {selectedCategorySlug === "todo"
                  ? "Lugares recomendados en el mundo"
                  : `Lugares de ${selectedCategoryTitle}`}
              </h2>
              <div className="small-muted">
                {filteredExperiences.length} {t("explore.resultsCount")}
              </div>
            </div>

            {locationsLoading ? (
              renderGridSkeleton(8)
            ) : error && filteredExperiences.length === 0 ? (
              <div className="muted error">{error}</div>
            ) : (
              <div className="experiences-grid">
                {filteredExperiences.length === 0 ? (
                  <div className="muted">{t("explore.noPlacesForCategory")}</div>
                ) : (
                  filteredExperiences.map((exp, idx) => (
                    <div
                      key={exp.id}
                      className="experience-card"
                      onClick={() => handleExperienceClick(exp)}
                    >
                      <div className="card-image">
                        {exp.image ? (
                          <OptimizedImage
                            src={exp.image}
                            alt={exp.title}
                            width={400}
                            height={260}
                            scrollRoot={scrollRoot}
                            priority={idx < 6}
                          />
                        ) : (
                          <div className="no-image">No image</div>
                        )}
                      </div>
                      <div className="card-content">
                        <h3 className="card-title">{exp.title}</h3>
                        <p className="card-description">{exp.description}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* POPULARES */}
          <div className="experiences-section">
            <div className="section-header">
              <h2>{t("explore.popular")}</h2>
            </div>

            {locationsLoading ? (
              renderGridSkeleton(6)
            ) : (
              <div className="experiences-grid">
                {popularExperiences.map((exp, idx) => (
                  <div
                    key={exp.id}
                    className="experience-card"
                    onClick={() => handleExperienceClick(exp)}
                  >
                    <div className="card-image">
                      {exp.image ? (
                        <OptimizedImage
                          src={exp.image}
                          alt={exp.title}
                          width={400}
                          height={260}
                          scrollRoot={scrollRoot}
                          priority={idx < 6}
                        />
                      ) : (
                        <div className="no-image">No image</div>
                      )}
                    </div>
                    <div className="card-content">
                      <h3 className="card-title">{exp.title}</h3>
                      <p className="card-description">{exp.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ADD LOCATION MODAL */}
      <Modal isOpen={showAddLocationModal} onClose={() => setShowAddLocationModal(false)}>
        <div style={{ padding: 18, width: "min(720px, 92vw)" }}>
          <h2 style={{ marginTop: 0 }}>Agregar un lugar</h2>
          <div className="small-muted" style={{ marginBottom: 12 }}>
            Completá los datos básicos. Podés pegar varias imágenes separadas por coma.
          </div>

          <form onSubmit={submitNewLocation} style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <label>Nombre *</label>
              <input
                value={newLoc.titulo}
                onChange={(e) => setNewLoc((p) => ({ ...p, titulo: e.target.value }))}
                placeholder="Ej: Teatro Colón"
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label>Categoría *</label>
              <select
                value={newLoc.fk_interest}
                onChange={(e) => setNewLoc((p) => ({ ...p, fk_interest: e.target.value }))}
              >
                {(categories || []).map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {translateCategory(t, c.slug, c.title)}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label>Descripción</label>
              <textarea
                rows={3}
                value={newLoc.descripcion}
                onChange={(e) => setNewLoc((p) => ({ ...p, descripcion: e.target.value }))}
                placeholder="Contanos qué hace especial este lugar…"
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label>País</label>
                <input
                  value={newLoc.country}
                  onChange={(e) => setNewLoc((p) => ({ ...p, country: e.target.value }))}
                  placeholder="Argentina"
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <label>Ciudad</label>
                <input
                  value={newLoc.city}
                  onChange={(e) => setNewLoc((p) => ({ ...p, city: e.target.value }))}
                  placeholder="Buenos Aires"
                />
              </div>
            </div>

            {/* ✅ MAP PICKER */}
            <div style={{ display: "grid", gap: 8 }}>
              <label style={{ fontWeight: 700 }}>Ubicación (click o arrastrá el pin)</label>

              {!MAPBOX_TOKEN ? (
                <div className="small-muted" style={{ color: "#c33" }}>
                  Falta configurar REACT_APP_MAPBOX_TOKEN para usar el mapa.
                </div>
              ) : (
                <div
                  style={{
                    height: 280,
                    borderRadius: 12,
                    overflow: "hidden",
                    border: "1px solid var(--color-border-light)",
                    background: "var(--color-bg-secondary)",
                    position: "relative",
                  }}
                >
                  <Map
                    {...createMapViewState}
                    onMove={(evt) => {
                      if (!evt || !evt.viewState) return;
                      const vs = evt.viewState;
                      if (
                        vs &&
                        Number.isFinite(vs.latitude) &&
                        Number.isFinite(vs.longitude) &&
                        Number.isFinite(vs.zoom)
                      ) {
                        setCreateMapViewState({
                          ...vs,
                          pitch: vs.pitch || 0,
                          bearing: vs.bearing || 0,
                        });
                      }
                    }}
                    onClick={(evt) => {
                      // react-map-gl gives evt.lngLat (object with lng/lat)
                      const ll = evt?.lngLat;
                      const lat = ll?.lat;
                      const lng = ll?.lng;
                      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                      setCoordsFromPicker(lat, lng);
                    }}
                    style={{ width: "100%", height: "100%" }}
                    mapStyle="mapbox://styles/mapbox/streets-v11"
                    mapboxAccessToken={MAPBOX_TOKEN}
                  >
                    <div style={{ position: "absolute", right: "0.625rem", top: "0.625rem", zIndex: 1 }}>
                      <NavigationControl showCompass showZoom />
                    </div>

                    {Array.isArray(pickerPos) && Number.isFinite(pickerPos[0]) && Number.isFinite(pickerPos[1]) && (
                      <Marker
                        longitude={pickerPos[1]}
                        latitude={pickerPos[0]}
                        anchor="bottom"
                        draggable
                        onDragEnd={(evt) => {
                          const raw = evt?.lngLat ?? null;
                          const lat = raw?.lat;
                          const lng = raw?.lng;
                          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                          setCoordsFromPicker(lat, lng);
                        }}
                      >
                        <svg
                          width="28"
                          height="28"
                          viewBox="0 0 24 24"
                          style={{ transform: "translate(-0.875rem,-1.75rem)" }}
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M12 2C8.1 2 5 5.1 5 9c0 5 7 12 7 12s7-7 7-12c0-3.9-3.1-7-7-7z"
                            fill="#ff7a45"
                          />
                          <circle cx="12" cy="9" r="2.3" fill="#fff" />
                        </svg>
                      </Marker>
                    )}

                    {Array.isArray(pickerPos) && Number.isFinite(pickerPos[0]) && Number.isFinite(pickerPos[1]) && (
                      <Popup
                        longitude={pickerPos[1]}
                        latitude={pickerPos[0]}
                        anchor="bottom"
                        onClose={() => {}}
                        closeButton={false}
                        closeOnClick={false}
                      >
                        <div style={{ fontSize: 12 }}>
                          Lat {pickerPos[0].toFixed(5)} <br />
                          Lng {pickerPos[1].toFixed(5)}
                        </div>
                      </Popup>
                    )}
                  </Map>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ display: "grid", gap: 6 }}>
                <label>Latitud</label>
                <input
                  value={newLoc.latitude}
                  onChange={(e) => setNewLoc((p) => ({ ...p, latitude: e.target.value }))}
                  placeholder="-34.6010807"
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <label>Longitud</label>
                <input
                  value={newLoc.longitude}
                  onChange={(e) => setNewLoc((p) => ({ ...p, longitude: e.target.value }))}
                  placeholder="-58.3831792"
                />
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label>Horarios (formato libre)</label>
              <input
                value={newLoc.opening_hours_raw}
                onChange={(e) => setNewLoc((p) => ({ ...p, opening_hours_raw: e.target.value }))}
                placeholder='Ej: "Mo-Sa 09:00-20:00; Su 09:00-17:00"'
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label>Sitio web</label>
              <input
                value={newLoc.website}
                onChange={(e) => setNewLoc((p) => ({ ...p, website: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label>Imágenes (URLs separadas por coma)</label>
              <textarea
                rows={2}
                value={newLoc.imagenes_raw}
                onChange={(e) => setNewLoc((p) => ({ ...p, imagenes_raw: e.target.value }))}
                placeholder="https://... , https://..."
              />
            </div>

            {createLocError ? (
              <div className="small-muted" style={{ color: "#c33" }}>
                {createLocError}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
              <button
                type="button"
                className="btn-clear"
                onClick={() => setShowAddLocationModal(false)}
                disabled={createLocLoading}
              >
                Cancelar
              </button>
              <ActionButton variant="create" type="submit" disabled={createLocLoading}>
                {createLocLoading ? "Guardando…" : "Publicar lugar"}
              </ActionButton>
            </div>
          </form>
        </div>
      </Modal>

      {/* DETAIL MODAL */}
      <WideModal
        isOpen={showDetailModal && !!selectedExperience}
        onClose={() => setShowDetailModal(false)}
      >
        {selectedExperience && (
          <div
            className="explore-detail"
            style={{
              width: "min(1100px, 96vw)",
              maxWidth: "96vw",
              boxSizing: "border-box",
              maxHeight: "85vh",
              overflowY: "auto",
              overflowX: "hidden",
              borderRadius: 16,
            }}
          >
            {(selectedExperience.imageLarge || selectedExperience.image) && (
              <div style={{ position: "relative" }}>
                <img
                  src={selectedExperience.imageLarge ?? selectedExperience.image}
                  alt={selectedExperience.title}
                  srcSet={selectedExperience.imageSrcSet ?? undefined}
                  sizes={selectedExperience.imageSrcSet ? defaultModalSizes : undefined}
                  style={{
                    width: "100%",
                    height: "320px",
                    objectFit: "cover",
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    display: "block",
                  }}
                />

                <div
                  style={{
                    position: "absolute",
                    left: 16,
                    right: 16,
                    bottom: 14,
                    padding: "12px 14px",
                    borderRadius: 14,
                    background: "rgba(0,0,0,0.45)",
                    backdropFilter: "blur(6px)",
                    color: "white",
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>
                    {selectedExperience.title}
                  </div>

                  <div style={{ marginTop: 6, fontSize: 14, opacity: 0.95 }}>
                    {googleLoading ? (
                      <span>Cargando rating…</span>
                    ) : place?.rating ? (
                      <>
                        <span style={{ marginRight: 8 }}>
                          <b>{place.rating}</b> / 5
                        </span>
                        <span style={{ marginRight: 10 }}>{renderStars(place.rating)}</span>
                        <span style={{ opacity: 0.9 }}>({place.userRatingCount ?? 0})</span>
                        {place.googleMapsUri ? (
                          <>
                            <span style={{ margin: "0 10px", opacity: 0.7 }}>·</span>
                            <a
                              href={place.googleMapsUri}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: "white", textDecoration: "underline" }}
                            >
                              Ver en Google Maps
                            </a>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <span style={{ opacity: 0.9 }}>Rating no disponible</span>
                    )}
                  </div>

                  {place?.formattedAddress ? (
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 13,
                        opacity: 0.9,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {place.formattedAddress}
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            <div style={{ padding: 18, boxSizing: "border-box" }}>
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 16,
                    lineHeight: 1.55,
                    opacity: 0.95,
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                  }}
                >
                  {selectedExperience.description}
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
                  Reviews
                </div>

                {googleLoading ? (
                  <div className="small-muted">Cargando reviews…</div>
                ) : googleError ? (
                  <div className="small-muted" style={{ color: "#c33" }}>
                    No se pudieron cargar reviews: {googleError}
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="small-muted">No hay reviews disponibles.</div>
                ) : (
                  <div style={{ display: "grid", gap: 12 }}>
                    {reviews.slice(0, 3).map((r, idx) => (
                      <div
                        key={`rev-${idx}`}
                        style={{
                          padding: 14,
                          borderRadius: 14,
                          background: "rgba(255,255,255,0.06)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          maxWidth: "100%",
                          boxSizing: "border-box",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {r?.author?.photoUri ? (
                            <img
                              src={r.author.photoUri}
                              alt={r.author?.name || "author"}
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                objectFit: "cover",
                                flex: "0 0 auto",
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                background: "rgba(255,255,255,0.10)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                flex: "0 0 auto",
                              }}
                            >
                              {(r?.author?.name || "G").slice(0, 1).toUpperCase()}
                            </div>
                          )}

                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, lineHeight: 1.1 }}>
                              {r?.author?.name || "Google user"}
                            </div>
                            <div style={{ fontSize: 13, opacity: 0.85 }}>
                              {r?.rating ? (
                                <>
                                  <span style={{ marginRight: 8 }}>{renderStars(r.rating)}</span>
                                  <span style={{ marginRight: 8 }}>{r.rating}/5</span>
                                </>
                              ) : null}
                              {r?.relativeTime ? <span>{r.relativeTime}</span> : null}
                            </div>
                          </div>
                        </div>

                        {r?.text ? (
                          <div
                            style={{
                              marginTop: 10,
                              fontSize: 14,
                              lineHeight: 1.5,
                              overflowWrap: "anywhere",
                              wordBreak: "break-word",
                            }}
                          >
                            {r.text}
                          </div>
                        ) : (
                          <div className="small-muted" style={{ marginTop: 10 }}>
                            Sin texto
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div
                className="modal-actions"
                style={{
                  marginTop: 18,
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <ActionButton
                  variant="create"
                  onClick={primaryCtaOnClick}
                  disabled={addLoading}
                >
                  {addLoading ? "Agregando…" : primaryCtaLabel}
                </ActionButton>

                <ActionButton variant="share" onClick={handleShare}>
                  {t("explore.share")}
                </ActionButton>

                {addError ? (
                  <div className="small-muted" style={{ color: "#c33", overflowWrap: "anywhere" }}>
                    {addError}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </WideModal>
    </div>
  );
}
