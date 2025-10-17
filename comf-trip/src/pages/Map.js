// src/pages/Map.jsx
import React, { useEffect, useState, useCallback } from "react";
// keep using the explicit mapbox entrypoint you already have
import Map, { Marker, NavigationControl, Popup } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import "../styles/map.css";
import Header from "../components/Header";
import "../styles/header.css";
import { useNavigate } from "react-router-dom";
import Select from "react-select";

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || "";
const API_URL_RAW = (process.env.REACT_APP_API_URL || "").replace(/\/$/, ""); // user-provided base

// try a few candidate endpoints (order matters)
const INTERESTS_CANDIDATES = [
  "/interests",
  "/users/interests",
  "/api/interests",
  "/api/users/interests"
];

const LOCATIONS_CANDIDATES = [
  "/locations",
  "/api/locations",
  "/public/locations", // supabase-like
  "/users/locations"
];

// small helper to safely parse imagenes column (some rows might be stringified)
function parseImagesField(imgField) {
  if (!imgField) return [];
  if (Array.isArray(imgField)) return imgField;
  try {
    if (typeof imgField === "string") {
      const trimmed = imgField.trim();
      // if it's like '["url"]' or '"..."' JSON.parse works
      if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
        if (typeof parsed === "object") return [parsed];
      }
      // fallback: split by commas (very tolerant)
      return trimmed.replace(/^\[|$/g, "").replace(/(^"|"$)/g, "").split(",").map(s => s.trim()).filter(Boolean);
    }
  } catch (e) {
    // fallback splitting
    return String(imgField).replace(/^\[|$/g, "").replace(/"/g, "").split(",").map(s => s.trim()).filter(Boolean);
  }
  return [];
}

export default function MapPage() {
  const navigate = useNavigate();

  // picker marker (draggable)
  // NOTE: using [lat, lng] tuple throughout for pickerPos (consistent with existing code)
  const [pickerPos, setPickerPos] = useState([-34.6037, -58.3816]); // [lat, lng]

  // map camera
  const [viewState, setViewState] = useState({
    longitude: -58.3816,
    latitude: -34.6037,
    zoom: 6,
  });

  // data & UI state
  const [locations, setLocations] = useState([]);
  const [interests, setInterests] = useState([]);
  const [selectedInterest, setSelectedInterest] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // resolved endpoints (detected at runtime)
  const [endpoints, setEndpoints] = useState({
    interests: null,
    locations: null,
  });

  // utility: test a URL and return json if ok
  const tryFetchJson = async (url) => {
    try {
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // trying to parse as JSON (interests/locations return arrays)
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        // still attempt to parse, but warn
        const txt = await res.text();
        try {
          return JSON.parse(txt);
        } catch (e) {
          throw new Error("Not JSON response");
        }
      }
      return await res.json();
    } catch (err) {
      throw err;
    }
  };

  // Auto-detect working endpoints for interests and locations
  useEffect(() => {
    let mounted = true;
    (async () => {
      setError(null);
      const base = API_URL_RAW || ""; // could be empty
      // function to try candidates list and return the first that works
      const detect = async (candidates) => {
        const errors = [];
        for (const cand of candidates) {
          // build candidate URL: if base is empty, try cand as absolute path on same host
          const url = base ? `${base}${cand}` : cand;
          try {
            const data = await tryFetchJson(url);
            return { url, data };
          } catch (err) {
            errors.push({ url, err: err.message });
          }
        }
        return { url: null, errors };
      };

      // detect interests
      const intRes = await detect(INTERESTS_CANDIDATES);
      if (!mounted) return;
      if (intRes.url) {
        // set interests immediately from returned data
        setInterests(Array.isArray(intRes.data) ? intRes.data : []);
        setEndpoints((e) => ({ ...e, interests: intRes.url }));
      } else {
        console.warn("Interests detection failed", intRes.errors);
        // keep interests empty
        setEndpoints((e) => ({ ...e, interests: null }));
      }

      // detect locations (we won't prefetch here; only detect and store)
      const locRes = await detect(LOCATIONS_CANDIDATES);
      if (!mounted) return;
      if (locRes.url) {
        setEndpoints((e) => ({ ...e, locations: locRes.url }));
      } else {
        console.warn("Locations detection failed", locRes.errors);
        setEndpoints((e) => ({ ...e, locations: null }));
      }
    })();
    return () => { mounted = false; };
  }, []);

  // fetch locations (optionally with interest slug)
  const fetchLocations = useCallback(async (interest = "") => {
    setLoading(true);
    setError(null);
    try {
      let baseUrl = endpoints.locations;
      if (!baseUrl) {
        // endpoints not detected yet — try the raw default first
        baseUrl = API_URL_RAW ? `${API_URL_RAW}/locations` : "/locations";
      }
      const q = interest ? `?interest=${encodeURIComponent(interest)}` : "";
      const url = `${baseUrl}${q}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} @ ${url}`);
      const data = await res.json();

      // NORMALIZE and FILTER invalid coordinates
      const normalized = (data || []).map((l) => {
        const latitude = Number(l.latitude);
        const longitude = Number(l.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          console.warn('Descartando location por coords inválidas:', l);
          return null;
        }
        return {
          ...l,
          imagenes: parseImagesField(l.imagenes),
          latitude,
          longitude,
        };
      }).filter(Boolean);

      console.log('Locations normalizadas:', normalized);
      setLocations(normalized);

      if (normalized.length === 0) {
        // no results is valid; show message but not as error
      }
    } catch (err) {
      console.error("fetchLocations error:", err);
      setError(String(err.message || err));
      setLocations([]);
    } finally {
      setLoading(false);
    }
  }, [endpoints.locations]);

  // initial fetch when endpoints resolved or when selectedInterest changes
  useEffect(() => {
    // If endpoints are unknown, wait until detection finishes (endpoints.locations === null or string)
    // A null means detection failed, undefined means not set yet - we still attempt once.
    // We'll attempt whenever endpoints.locations changes.
    fetchLocations(selectedInterest);
  }, [fetchLocations, selectedInterest, endpoints.locations]);

  // try to center on user's location
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            setPickerPos([lat, lng]);
            setViewState((v) => ({ ...v, latitude: lat, longitude: lng, zoom: 13 }));
          }
        },
        () => { /* ignore */ }
      );
    }
  }, []);

  // keep view centered on picker (optional)
  useEffect(() => {
    if (Array.isArray(pickerPos) && Number.isFinite(pickerPos[0]) && Number.isFinite(pickerPos[1])) {
      setViewState((v) => ({ ...v, latitude: pickerPos[0], longitude: pickerPos[1] }));
    } else {
      console.warn("pickerPos inválido, no centrar view:", pickerPos);
    }
  }, [pickerPos]);

  // color helper
  const colorForCategory = (slug) => {
    if (!slug) return "#1978c8";
    let h = 0;
    for (let i = 0; i < slug.length; i++) h = (h << 5) - h + slug.charCodeAt(i);
    const hue = Math.abs(h) % 360;
    return `hsl(${hue} 70% 45%)`;
  };

  return (
    <div className="map-root" style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <Header/>

      <main className="map-main" style={{ display: "flex", flex: 1 }}>
        <section className="map-left" style={{ width: 320, padding: 16, boxSizing: "border-box" }}>
          <h2>Localidades</h2>

          <label htmlFor="interest-select" style={{ display: "block", marginBottom: 8 }}>Filtrar por categoría</label>
            <Select
                className="dropdown-select"
                classNamePrefix="react-select"
                placeholder="Todas"
                options={interests.map(it => ({
                    value: it.slug ?? it.id ?? it.title,
                    label: it.title ?? it.slug ?? it.id
                }))}
                value={
                    selectedInterest
                        ? {
                            value: selectedInterest,
                            label:
                                interests.find(i =>
                                    i.slug === selectedInterest ||
                                    i.id === selectedInterest ||
                                    i.title === selectedInterest
                                )?.title || selectedInterest
                        }
                        : null
                }
                onChange={(option) => setSelectedInterest(option.value)}
                isSearchable={false}
            />


            <div style={{ marginBottom: 12 , marginTop:20, display:"flex", gap:3}}>
            <button className="btn-primary" onClick={() => fetchLocations(selectedInterest)} style={{ marginRight: 8 }}>
              Aplicar
            </button>
            <button className="btn-secondary" onClick={() => { setSelectedInterest(""); fetchLocations(""); }}>
              Mostrar todo
            </button>
          </div>

          <div style={{ maxHeight: "60vh", overflow: "auto" }}>
            {loading && <p>Cargando...</p>}
            {error && (
              <div>
                <p style={{ color: "red" }}>No se pudieron cargar las localidades</p>
                <small style={{ color: "#aa0000", whiteSpace: "pre-wrap" }}>{error}</small>
              </div>
            )}
            {!loading && !error && locations.length === 0 && <p>No hay localidades</p>}

            <ul style={{ listStyle: "none", padding: 0 }}>
              {locations.map((loc) => (
                <li
                  key={loc.id}
                  style={{ marginBottom: 10, cursor: "pointer" }}
                  onClick={() => {
                    if (Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)) {
                      setViewState((v) => ({ ...v, latitude: loc.latitude, longitude: loc.longitude, zoom: 14 }));
                      setSelectedLocation(loc);
                    } else {
                      console.warn("Intento de centrar en location con coords inválidas:", loc);
                    }
                  }}
                >
                  <strong>{loc.titulo}</strong>
                  <div style={{ fontSize: 13, color: "#666" }}>{loc.fk_interest}</div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="map-canvas" style={{ flex: 1 }}>
          <Map
            {...viewState}
            onMove={(evt) => {
              if (!evt || !evt.viewState) {
                console.warn('onMove sin viewState válido', evt);
                return;
              }
              setViewState(evt.viewState);
            }}
            style={{ width: "100%", height: "100%" }}
            mapStyle="mapbox://styles/mapbox/streets-v11"
            mapboxAccessToken={MAPBOX_TOKEN}
          >
            <div style={{ position: "absolute", right: 10, top: 10, zIndex: 1 }}>
              <NavigationControl showCompass showZoom />
            </div>

            {locations.map((loc) => (
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
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    style={{ transform: "translate(-12px,-24px)", cursor: "pointer" }}
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill={colorForCategory(loc.fk_interest)} />
                    <circle cx="12" cy="9" r="2.5" fill="#fff" />
                  </svg>
                </Marker>
              ) : null
            ))}

            {selectedLocation && Number.isFinite(selectedLocation.latitude) && Number.isFinite(selectedLocation.longitude) && (
              <Popup
                longitude={selectedLocation.longitude}
                latitude={selectedLocation.latitude}
                anchor="left"
                onClose={() => setSelectedLocation(null)}
                closeOnClick={false}
                offset={[-5, -43]}
              >
                <div style={{ maxWidth: 260}}>
                  <h3 style={{ margin: "0 0 6px 0" }}>{selectedLocation.titulo}</h3>
                  <div style={{ fontSize: 13, color: "#444", marginBottom: 6 }}>
                    {selectedLocation.descripcion?.slice(0, 200)}
                  </div>
                  {selectedLocation.imagenes && selectedLocation.imagenes.length > 0 && (
                    <img
                      src={selectedLocation.imagenes[0]}
                      alt={selectedLocation.titulo}
                      style={{ width: "100%", height: "auto", maxHeight:150, borderRadius: 6 }}
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  )}
                </div>
              </Popup>
            )}

            {/* draggable picker */}
            <Marker
              longitude={pickerPos[1]}
              latitude={pickerPos[0]}
              anchor="bottom"
              draggable
              onDragEnd={(evt) => {
                // evt.lngLat puede ser array [lng, lat] o objeto { lng, lat }
                const raw = evt?.lngLat ?? evt?.lngLatRaw ?? evt?.point ?? null;
                let lng, lat;

                // different shapes handled defensively
                if (Array.isArray(raw) && raw.length >= 2) {
                  [lng, lat] = raw;
                } else if (raw && typeof raw === "object") {
                  if (typeof raw.lng === "number" && typeof raw.lat === "number") {
                    lng = raw.lng;
                    lat = raw.lat;
                  } else if (typeof raw[0] === "number" && typeof raw[1] === "number") {
                    [lng, lat] = raw;
                  }
                }

                if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                  console.warn("onDragEnd: lngLat inválido:", evt?.lngLat, "raw:", raw);
                  return;
                }

                // pickerPos uses [lat, lng]
                setPickerPos([lat, lng]);
                setSelectedLocation(null);
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                style={{ transform: "translate(-14px,-28px)" }}
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 2C8.1 2 5 5.1 5 9c0 5 7 12 7 12s7-7 7-12c0-3.9-3.1-7-7-7z" fill="#ff7a45" />
                <circle cx="12" cy="9" r="2.3" fill="#fff" />
              </svg>
            </Marker>

            <Popup
              longitude={Number.isFinite(pickerPos[1]) ? pickerPos[1] : 0}
              latitude={Number.isFinite(pickerPos[0]) ? pickerPos[0] : 0}
              anchor="bottom"
              onClose={() => {}}
              closeButton={false}
              closeOnClick={false}
            >
              <div style={{ fontSize: 12 }}>
                {Number.isFinite(pickerPos[0]) ? `Lat: ${pickerPos[0].toFixed(5)}` : "Lat: N/A"} <br />
                {Number.isFinite(pickerPos[1]) ? `Lon: ${pickerPos[1].toFixed(5)}` : "Lon: N/A"}
              </div>
            </Popup>
          </Map>
        </section>
      </main>
    </div>
  );
}
