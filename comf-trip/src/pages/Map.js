// src/pages/Map.jsx
import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
// ✅ rename Map component so we don't shadow JS built-in Map()
import MapGL, { Marker, NavigationControl, Popup } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import "../styles/map.css";
import "../styles/header.css";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import { useTranslation } from "../i18n";
import LoadingSpinner from "../components/LoadingSpinner";
import { translateCategory } from "../helpers/categoryTranslations";

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || "";
const API_URL_RAW = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");

/**
 * Build a stable /api/* URL even if REACT_APP_API_URL is either:
 *  - https://domain.tld
 *  - https://domain.tld/api
 */
function buildApiUrl(pathAfterApi) {
  const base = API_URL_RAW || "";
  if (!base) return `/api/${pathAfterApi}`;
  if (base.endsWith("/api")) return `${base}/${pathAfterApi}`;
  return `${base}/api/${pathAfterApi}`;
}

// ✅ user-provided route (stable)
const INTERESTS_URL = buildApiUrl("interests");
const LOCATIONS_URL = buildApiUrl("locations");

// small helper to safely parse imagenes/images (some rows might be stringified)
function parseImagesField(imgField) {
  if (!imgField) return [];
  if (Array.isArray(imgField)) {
    return imgField
      .map((x) => {
        if (!x) return null;
        if (typeof x === "string") return x;
        if (typeof x === "object") return x.url || x.src || x.image || null;
        return null;
      })
      .filter(Boolean);
  }

  try {
    if (typeof imgField === "string") {
      const trimmed = imgField.trim();
      if (
        (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith('"') && trimmed.endsWith('"'))
      ) {
        const parsed = JSON.parse(trimmed);
        return parseImagesField(parsed);
      }
      return trimmed
        .replace(/^\[|]$/g, "")
        .replace(/(^"|"$)/g, "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  } catch (e) {
    return String(imgField)
      .replace(/^\[|]$/g, "")
      .replace(/"/g, "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [];
}

function parseNumberLoose(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (typeof v === "string") {
    const s = v.trim().replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function normalizeLocation(l) {
  const latitude = parseNumberLoose(l.latitude ?? l.lat);
  const longitude = parseNumberLoose(l.longitude ?? l.lng ?? l.lon);

  const title = l.title ?? l.titulo ?? l.name ?? "";
  const description = l.description ?? l.descripcion ?? "";
  const images = parseImagesField(l.images ?? l.imagenes ?? l.image_urls ?? l.image_url);

  const interestKeyRaw =
    l.interest ??
    l.fk_interest ??
    l.interest_id ??
    l.category ??
    l.category_id ??
    l.interestId ??
    "";

  const interestKey =
    interestKeyRaw === null || interestKeyRaw === undefined ? "" : String(interestKeyRaw);

  return {
    ...l,
    id: String(l.id ?? l.location_id ?? title ?? Math.random()),
    title,
    description,
    images,
    interestKey,
    city: l.city ?? l.ciudad ?? "",
    country: l.country ?? l.pais ?? "",
    website: l.website ?? l.web ?? "",
    opening_hours: l.opening_hours ?? l.horario ?? null,
    latitude,
    longitude,
  };
}

/**
 * ✅ Pin that is *geometrically* anchored at the tip.
 * The classic pin path’s “tip” is at y=22, so we use viewBox height 22.
 * Rendering at height=24 scales the tip to y=24 (the element bottom),
 * so Marker anchor="bottom" is exact at ANY zoom level.
 */
function PinSvg({ color = "#1978c8", size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 22"
      style={{ display: "block", cursor: "pointer" }}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        fill={color}
      />
      <circle cx="12" cy="9" r="2.5" fill="#fff" />
    </svg>
  );
}

export default function MapPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // picker marker (draggable) — using [lat, lng]
  const [pickerPos, setPickerPos] = useState([-34.6037, -58.3816]);

  // map camera
  const [viewState, setViewState] = useState({
    longitude: -58.3816,
    latitude: -34.6037,
    zoom: 6,
    pitch: 0,
    bearing: 0,
  });

  // data & UI state
  const [allLocations, setAllLocations] = useState([]); // ✅ after interest filter, before city filter
  const [locations, setLocations] = useState([]); // ✅ visible after city filter
  const [interests, setInterests] = useState([]);
  const [selectedInterest, setSelectedInterest] = useState("");
  const [selectedCity, setSelectedCity] = useState(""); // ✅ city filter
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingInterests, setLoadingInterests] = useState(true);
  const [error, setError] = useState(null);

  // auto-center behavior
  const userMovedRef = useRef(false);
  const geoCenteredRef = useRef(false);

  // interests maps (for label + matching)
  const interestById = useMemo(() => {
    const m = new Map();
    (interests || []).forEach((it) => {
      if (it?.id !== undefined && it?.id !== null) m.set(String(it.id), it);
      if (it?.slug) m.set(String(it.slug), it);
      if (it?.title) m.set(String(it.title), it);
    });
    return m;
  }, [interests]);

  // Fetch interests
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingInterests(true);
      try {
        const res = await fetch(INTERESTS_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status} @ ${INTERESTS_URL}`);
        const data = await res.json();
        if (!mounted) return;
        setInterests(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("fetchInterests error:", err);
        if (!mounted) return;
        setInterests([]);
      } finally {
        if (mounted) setLoadingInterests(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const matchesSelectedInterest = useCallback(
    (loc, sel) => {
      if (!sel) return true;
      const selStr = String(sel);

      if (loc.interestKey && String(loc.interestKey) === selStr) return true;

      const selIt = interestById.get(selStr);
      if (selIt) {
        const selId = selIt.id != null ? String(selIt.id) : null;
        const selSlug = selIt.slug != null ? String(selIt.slug) : null;
        const selTitle = selIt.title != null ? String(selIt.title) : null;

        if (selId && String(loc.interestKey) === selId) return true;
        if (selSlug && String(loc.interestKey) === selSlug) return true;
        if (selTitle && String(loc.interestKey) === selTitle) return true;

        if (
          loc.interest &&
          (String(loc.interest) === selId ||
            String(loc.interest) === selSlug ||
            String(loc.interest) === selTitle)
        ) {
          return true;
        }
      }

      if (loc.fk_interest && String(loc.fk_interest) === selStr) return true;
      if (loc.interest_id && String(loc.interest_id) === selStr) return true;
      if (loc.category && String(loc.category) === selStr) return true;

      return false;
    },
    [interestById]
  );

  // fetch locations
  const fetchLocations = useCallback(
    async (interest = "") => {
      setLoading(true);
      setError(null);

      const sel = interest ? String(interest) : "";
      const paramAttempts = sel ? ["interest", "interest_id", "fk_interest", "category"] : [null];

      try {
        let data = null;
        let lastErr = null;

        for (const p of paramAttempts) {
          const url = p ? `${LOCATIONS_URL}?${p}=${encodeURIComponent(sel)}` : LOCATIONS_URL;

          try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
            const json = await res.json();
            data = Array.isArray(json) ? json : [];
            if (!sel || data.length > 0) break;
          } catch (e) {
            lastErr = e;
          }
        }

        if (!data) throw lastErr || new Error("Failed to load locations");

        const normalized = (data || [])
          .map(normalizeLocation)
          .filter((l) => Number.isFinite(l.latitude) && Number.isFinite(l.longitude));

        const filteredByInterest = sel
          ? normalized.filter((l) => matchesSelectedInterest(l, sel))
          : normalized;

        setAllLocations(filteredByInterest);
      } catch (err) {
        console.error("fetchLocations error:", err);
        setError(String(err.message || err));
        setAllLocations([]);
        setLocations([]);
      } finally {
        setLoading(false);
      }
    },
    [matchesSelectedInterest]
  );

  // refetch when interest changes
  useEffect(() => {
    // changing interest should clear selectedLocation (could disappear)
    setSelectedLocation(null);
    // and reset city if it no longer exists (we’ll keep it but filtering will yield 0)
    fetchLocations(selectedInterest);
  }, [fetchLocations, selectedInterest]);

  // apply city filter client-side (and optionally auto-center)
  useEffect(() => {
    const citySel = (selectedCity || "").trim().toLowerCase();

    const visible = !citySel
      ? allLocations
      : allLocations.filter((l) => String(l.city || "").trim().toLowerCase() === citySel);

    setLocations(visible);

    // if selectedLocation is no longer visible, close popup
    if (selectedLocation) {
      const stillThere = visible.some((l) => String(l.id) === String(selectedLocation.id));
      if (!stillThere) setSelectedLocation(null);
    }

    // ✅ If user hasn't moved the map manually, re-center to first visible result
    if (visible.length > 0 && !userMovedRef.current && !geoCenteredRef.current) {
      const first = visible[0];
      setViewState((v) => ({
        ...v,
        latitude: first.latitude,
        longitude: first.longitude,
        zoom: Math.max(v.zoom || 0, 11),
        pitch: v.pitch || 0,
        bearing: v.bearing || 0,
      }));
    }
  }, [allLocations, selectedCity]); // eslint-disable-line react-hooks/exhaustive-deps

  // derive city options from current interest-filtered set
  const cityOptions = useMemo(() => {
    const set = new Map(); // key: lower, value: display
    (allLocations || []).forEach((l) => {
      const raw = String(l.city || "").trim();
      if (!raw) return;
      const key = raw.toLowerCase();
      if (!set.has(key)) set.set(key, raw);
    });

    const arr = Array.from(set.values()).sort((a, b) => a.localeCompare(b));
    return [{ value: "", label: t("map.all") || "All" }].concat(
      arr.map((c) => ({ value: c, label: c }))
    );
  }, [allLocations, t]);

  // try to center on user's location
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            geoCenteredRef.current = true;
            setPickerPos([lat, lng]);
            setViewState((v) => ({
              ...v,
              latitude: lat,
              longitude: lng,
              zoom: 13,
              pitch: v.pitch || 0,
              bearing: v.bearing || 0,
            }));
          }
        },
        () => {}
      );
    }
  }, []);

  const colorForCategory = (interestKey) => {
    const key = interestKey ? String(interestKey) : "default";
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h << 5) - h + key.charCodeAt(i);
    const hue = Math.abs(h) % 360;
    return `hsl(${hue} 70% 45%)`;
  };

  const labelForLocationInterest = (loc) => {
    const it =
      interestById.get(String(loc.interestKey)) || interestById.get(String(loc.fk_interest)) || null;
    if (it) {
      const slug = it.slug ?? String(it.id ?? "");
      return translateCategory(t, slug, it.title ?? slug);
    }
    if (loc.interestKey) return translateCategory(t, String(loc.interestKey), String(loc.interestKey));
    return "";
  };

  if (loading && locations.length === 0) {
    return (
      <div className="map-root">
        <LoadingSpinner message={t("map.loading")} fullScreen />
      </div>
    );
  }

  return (
    <div className="map-root">
      <main className="map-main">
        <section className="map-left">
          <h2>{t("map.locations")}</h2>

          {/* Category filter */}
          <label htmlFor="interest-select" style={{ display: "block", marginBottom: 10 }}>
            {t("map.filterByCategory")}
          </label>
          <div style={{ marginBottom: 14 }}>
            <Select
              className="dropdown-select"
              classNamePrefix="react-select"
              isLoading={loadingInterests}
              isSearchable={false}
              options={[
                { value: "", label: t("map.all") },
                ...(interests || []).map((it) => {
                  const slug = it.slug ?? String(it.id ?? "");
                  const translatedTitle = translateCategory(t, slug, it.title ?? slug);
                  return {
                    value: it.id != null ? String(it.id) : it.slug ?? it.title ?? "",
                    label: translatedTitle,
                  };
                }),
              ]}
              value={
                selectedInterest
                  ? {
                      value: selectedInterest,
                      label: (() => {
                        const found = interestById.get(String(selectedInterest));
                        if (found) {
                          const slug = found.slug ?? String(found.id ?? "");
                          return translateCategory(t, slug, found.title ?? slug);
                        }
                        return selectedInterest;
                      })(),
                    }
                  : { value: "", label: t("map.all") }
              }
              onChange={(option) => {
                const v = option?.value ?? "";
                setSelectedInterest(String(v));
              }}
            />
          </div>

          {/* ✅ City filter */}
          <label htmlFor="city-select" style={{ display: "block", marginBottom: 10 }}>
            {t("map.filterByCity") || "Filter by city"}
          </label>
          <div style={{ marginBottom: 18 }}>
            <Select
              className="dropdown-select"
              classNamePrefix="react-select"
              isSearchable
              options={cityOptions}
              value={
                selectedCity
                  ? { value: selectedCity, label: selectedCity }
                  : { value: "", label: t("map.all") || "All" }
              }
              onChange={(option) => {
                const v = option?.value ?? "";
                setSelectedCity(String(v));
              }}
              noOptionsMessage={() => t("map.noCities") || "No cities"}
            />
          </div>

          <div style={{ maxHeight: "60vh", overflow: "auto" }}>
            {error && (
              <div>
                <p style={{ color: "red" }}>{t("map.loadError")}</p>
                <small style={{ color: "#aa0000", whiteSpace: "pre-wrap" }}>{error}</small>
              </div>
            )}
            {!loading && !error && locations.length === 0 && <p>{t("map.noLocations")}</p>}

            <ul style={{ listStyle: "none", padding: 0 }}>
              {locations.map((loc) => (
                <li
                  key={loc.id}
                  style={{ marginBottom: 10, cursor: "pointer" }}
                  onClick={() => {
                    if (Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)) {
                      setViewState((v) => ({
                        ...v,
                        latitude: loc.latitude,
                        longitude: loc.longitude,
                        zoom: 14,
                        pitch: v.pitch || 0,
                        bearing: v.bearing || 0,
                      }));
                      setSelectedLocation(loc);
                    }
                  }}
                >
                  <strong>{loc.title}</strong>
                  <div style={{ fontSize: 13, color: "#666" }}>
                    {labelForLocationInterest(loc)}
                    {loc.city || loc.country
                      ? ` • ${[loc.city, loc.country].filter(Boolean).join(", ")}`
                      : ""}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="map-canvas">
          {!MAPBOX_TOKEN ? (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100%",
                color: "red",
              }}
            >
              <p>{t("map.noToken") || "Mapbox token no configurado"}</p>
            </div>
          ) : viewState && Number.isFinite(viewState.latitude) && Number.isFinite(viewState.longitude) ? (
            <MapGL
              {...viewState}
              onMove={(evt) => {
                if (!evt || !evt.viewState) return;
                userMovedRef.current = true;

                const newViewState = evt.viewState;
                if (
                  newViewState &&
                  Number.isFinite(newViewState.latitude) &&
                  Number.isFinite(newViewState.longitude) &&
                  Number.isFinite(newViewState.zoom)
                ) {
                  setViewState({
                    ...newViewState,
                    pitch: newViewState.pitch || 0,
                    bearing: newViewState.bearing || 0,
                  });
                }
              }}
              style={{ width: "100%", height: "100%" }}
              mapStyle="mapbox://styles/mapbox/streets-v11"
              mapboxAccessToken={MAPBOX_TOKEN}
            >
              <div style={{ position: "absolute", right: "0.625rem", top: "0.625rem", zIndex: 1 }}>
                <NavigationControl showCompass showZoom />
              </div>

              {/* ✅ LOCATION MARKERS: anchor bottom + tip-aligned SVG => accurate at ALL zoom levels */}
              {locations.map((loc) =>
                Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude) ? (
                  <Marker
                    key={`loc-${loc.id}`}
                    longitude={loc.longitude}
                    latitude={loc.latitude}
                    anchor="bottom"
                    onClick={(e) => {
                      e?.originalEvent && e.originalEvent.stopPropagation();
                      setSelectedLocation(loc);
                    }}
                  >
                    <PinSvg color={colorForCategory(loc.interestKey)} size={24} />
                  </Marker>
                ) : null
              )}

              {selectedLocation &&
                Number.isFinite(selectedLocation.latitude) &&
                Number.isFinite(selectedLocation.longitude) && (
                  <Popup
                    longitude={selectedLocation.longitude}
                    latitude={selectedLocation.latitude}
                    anchor="left"
                    onClose={() => setSelectedLocation(null)}
                    closeOnClick={false}
                    offset={10}
                  >
                    <div style={{ maxWidth: 280 }}>
                      <h3 style={{ margin: "0 0 0.375rem 0" }}>{selectedLocation.title}</h3>

                      <div style={{ fontSize: "0.8125rem", color: "#444", marginBottom: "0.375rem" }}>
                        {labelForLocationInterest(selectedLocation)}
                        {(selectedLocation.city || selectedLocation.country) && (
                          <>
                            {" "}
                            • {[selectedLocation.city, selectedLocation.country].filter(Boolean).join(", ")}
                          </>
                        )}
                      </div>

                      <div style={{ fontSize: "0.8125rem", color: "#444", marginBottom: "0.5rem" }}>
                        {selectedLocation.description?.slice(0, 220)}
                        {selectedLocation.description && selectedLocation.description.length > 220 ? "…" : ""}
                      </div>

                      {selectedLocation.images && selectedLocation.images.length > 0 && (
                        <img
                          src={selectedLocation.images[0]}
                          alt={selectedLocation.title}
                          style={{ width: "100%", height: "auto", maxHeight: 160, borderRadius: 6 }}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      )}
                    </div>
                  </Popup>
                )}

              {/* draggable picker (tip-aligned SVG as well) */}
              {Array.isArray(pickerPos) &&
                Number.isFinite(pickerPos[0]) &&
                Number.isFinite(pickerPos[1]) && (
                  <Marker
                    longitude={pickerPos[1]}
                    latitude={pickerPos[0]}
                    anchor="bottom"
                    draggable
                    onDragEnd={(evt) => {
                      const raw = evt?.lngLat ?? null;
                      let lng, lat;

                      if (raw && typeof raw === "object") {
                        if (typeof raw.lng === "number" && typeof raw.lat === "number") {
                          lng = raw.lng;
                          lat = raw.lat;
                        } else if (typeof raw[0] === "number" && typeof raw[1] === "number") {
                          lng = raw[0];
                          lat = raw[1];
                        }
                      }

                      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

                      setPickerPos([lat, lng]);
                      setSelectedLocation(null);
                    }}
                  >
                    <PinSvg color="#ff7a45" size={28} />
                  </Marker>
                )}

              {Array.isArray(pickerPos) &&
                Number.isFinite(pickerPos[0]) &&
                Number.isFinite(pickerPos[1]) && (
                  <Popup
                    longitude={pickerPos[1]}
                    latitude={pickerPos[0]}
                    anchor="bottom"
                    onClose={() => {}}
                    closeButton={false}
                    closeOnClick={false}
                    offset={16}
                  >
                    <div style={{ fontSize: 12 }}>
                      {`${t("map.latitude")} ${pickerPos[0].toFixed(5)}`} <br />
                      {`${t("map.longitude")} ${pickerPos[1].toFixed(5)}`}
                    </div>
                  </Popup>
                )}
            </MapGL>
          ) : null}
        </section>
      </main>
    </div>
  );
}
