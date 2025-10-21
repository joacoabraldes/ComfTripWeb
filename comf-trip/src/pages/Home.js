// src/pages/Home.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Country, City } from "country-state-city";
import "../styles/home.css";
import Header from "../components/Header";
import { apiGet } from "./api";
import Map, { Marker, NavigationControl, Popup } from "react-map-gl/mapbox";
import OptimizedImage from "../components/OptimizedImage";
const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || "";

export default function Home() {
  const navigate = useNavigate();

  const [trips, setTrips] = useState([]);
  const [popular, setPopular] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [loadingPopular, setLoadingPopular] = useState(true);

  // carousel state
  const [index, setIndex] = useState(0);
  const carouselLen = popular.length;
  const carouselAutoRef = useRef(null);

  // fetch user's trips
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingTrips(true);
      try {
        const data = await apiGet("/trips");
        if (!mounted) return;
        setTrips(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Home: fetch trips error", err);
        setTrips([]);
      } finally {
        if (mounted) setLoadingTrips(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // fetch popular locations (top by relevance)
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingPopular(true);
      try {
        const data = await apiGet("/locations?limit=8");
        if (!mounted) return;
        setPopular(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Home: fetch popular locations error", err);
        setPopular([]);
      } finally {
        if (mounted) setLoadingPopular(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // simple auto-advance carousel (every 4s)
  useEffect(() => {
    if (carouselLen <= 1) return;
    carouselAutoRef.current && clearInterval(carouselAutoRef.current);
    carouselAutoRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % carouselLen);
    }, 4000);
    return () => clearInterval(carouselAutoRef.current);
  }, [carouselLen]);

  const fmtDate = (d) => {
    if (!d) return "-";
    const date = d.split("T")[0].split("-");
    const yy = date[0];
    const mm = date[1];
    const dd = date[2];
    return `${dd}/${mm}/${yy}`;
  };

  const fmtHour = (t) => {
    if (!t) return "-";
    const time = t.split(":");
    const hour = time[0];
    const min = time[1];
    return `${hour}:${min}`;
  };

  function goPrev() {
    setIndex((i) => (i - 1 + carouselLen) % carouselLen);
  }
  function goNext() {
    setIndex((i) => (i + 1) % carouselLen);
  }

  const upcoming = trips
    .filter((t) => t.start_date)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  const nextTrip = upcoming.length ? upcoming[0] : null;

  const normalizeDate = (d) => {
    if (!d) return new Date();
    const date = d.split("T")[0].split("-");
    const yy = Number(date[0]);
    const mm = Number(date[1]) - 1;
    const dd = Number(date[2]);
    return new Date(yy, mm, dd);
  };

  /**
   * Robust image parser and helpers (normalize many shapes)
   */
  const safeParseImages = (im) => {
    // Accept: null, array, JSON-stringified array, comma-separated string, object with .url or .urls
    if (!im) return [];
    if (Array.isArray(im)) return im.map((it) => (typeof it === "object" && it !== null && it.url ? it.url : it));
    if (typeof im === "string") {
      // try JSON first
      try {
        const parsed = JSON.parse(im);
        if (Array.isArray(parsed)) return parsed.map((it) => (typeof it === "object" && it !== null && it.url ? it.url : it));
        return [parsed];
      } catch (e) {
        // fallback: comma-separated list or single url
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

  /**
   * Pick thumbnail candidate:
   * - prefer /thumb/ Wikimedia URLs (already sized)
   * - prefer '/<N>px-' patterns
   * - prefer second element (common API pattern: [full, thumb])
   * - fallback to first
   */
  const pickBestImage = (imgs = []) => {
    if (!Array.isArray(imgs) || imgs.length === 0) return null;
    const urls = imgs.filter(Boolean).map((u) => (typeof u === "string" ? u : String(u)));
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
    if (!thumbUrl.match(/\/\d+px-/)) return null;
    return widths
      .map((w) => {
        const s = thumbUrl.replace(/\/\d+px-/, `/${w}px-`);
        return `${s} ${w}w`;
      })
      .join(", ");
  };

  // state & logic used by current-trip / places
  const [currentTrip, setCurrentTrip] = useState(null);
  const [currentPlace, setCurrentPlace] = useState(null);
  const [nextPlace, setNextPlace] = useState(null);
  const [hasNextToday, setHasNextToday] = useState(true);
  const [loadingCurrent, setLoadingCurrent] = useState(true);

  // map viewport (centered on first place or default)
  const [viewState, setViewState] = useState({
    latitude: -34.6037,
    longitude: -58.3816,
    zoom: 11,
  });

  const [selectedLocationOnMap, setSelectedLocationOnMap] = useState(null);

  useEffect(() => {
    function updateStatus() {
      const now = new Date();
      const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const tripNow =
        nextTrip &&
        normalizeDate(nextTrip.start_date) <= currentDay &&
        normalizeDate(nextTrip.end_date) >= currentDay
          ? nextTrip
          : null;

      setCurrentTrip(tripNow);

      if (!tripNow) {
        setCurrentPlace(null);
        return;
      }

      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const todayDate = currentDay.getTime();

      const placeNow = tripNow.places.find((p) => {
        const pDate = normalizeDate(p.date).getTime();
        if (pDate !== todayDate) return false;
        if (!p.start_hour && !p.end_hour) return true;
        const [sh, sm] = (p.start_hour || "00:00").split(":").map(Number);
        const [eh, em] = (p.end_hour || "23:59").split(":").map(Number);
        const startMinutes = sh * 60 + sm;
        const endMinutes = eh * 60 + em;
        return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
      });

      setCurrentPlace(placeNow || null);

      const placeNext = tripNow.places.find((p) => {
        const pDate = normalizeDate(p.date).getTime();
        if (pDate !== todayDate) {
          setHasNextToday(false);
          return pDate > todayDate;
        }
        if (!p.start_hour) {
          setHasNextToday(true);
          return true;
        }
        const [sh, sm] = p.start_hour.split(":").map(Number);
        const startMinutes = sh * 60 + sm;
        setHasNextToday(true);
        return nowMinutes < startMinutes;
      });

      setNextPlace(placeNext || null);
      if (!placeNext) setHasNextToday(false);
    }

    updateStatus();
    const interval = setInterval(updateStatus, 60 * 1000);
    setLoadingCurrent(false);
    return () => clearInterval(interval);
  }, [nextTrip]);

  useEffect(() => {
    if (!currentTrip) return;

    (async () => {
      try {
        const destination = currentTrip.destination || "";
        const [cityRaw, countryRaw] = destination.split(",").map((s) => s.trim());
        if (!cityRaw || !countryRaw) return;

        const normalize = (s) =>
          s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

        // Find country tolerant to name variants
        const country = Country.getAllCountries().find(
          (c) =>
            normalize(c.name) === normalize(countryRaw) ||
            normalize(c.name).includes(normalize(countryRaw)) ||
            normalize(countryRaw).includes(normalize(c.name))
        );

        if (!country) {
          console.warn("Country not found:", countryRaw);
          return;
        }

        const cities = City.getCitiesOfCountry(country.isoCode);
        const match = cities.find(
          (c) =>
            normalize(c.name) === normalize(cityRaw) ||
            normalize(c.name).includes(normalize(cityRaw)) ||
            normalize(cityRaw).includes(normalize(c.name))
        );

        if (!match) {
          console.warn(`City "${cityRaw}" not found in ${country.name}`);
          return;
        }

        setViewState({
          latitude: Number(match.latitude),
          longitude: Number(match.longitude),
          zoom: 13,
        });
      } catch (err) {
        console.error("Error getting coordinates:", err);
      }
    })();
  }, [currentTrip]);

  const timeBetween = () => {
    if (!hasNextToday) return "";
    if (currentPlace) {
      if (!nextPlace?.start_hour && !currentPlace?.end_hour) return "";
      const [sh, sm] = (nextPlace?.start_hour || "00:00").split(":").map(Number);
      const [eh, em] = (currentPlace?.end_hour || "00:00").split(":").map(Number);
      const minutesBetween = sh * 60 + sm - (eh * 60 + em);
      const M = Math.abs(minutesBetween % 60);
      const H = Math.floor(Math.abs(minutesBetween) / 60);
      if (!H && !M) {
        return "La proxima actividad comenzara apenas termine la actual";
      }
      return `Al terminar la actividad quedara${H === 1 || (H === 0 && M === 1) ? "" : "n"} ${
        H ? `${H} hora${H === 1 ? "" : "s"}` : ""
      }${H && M ? " y " : " "}${M ? `${M} minuto${M === 1 ? "" : "s"}` : ""} para la proxima actividad`;
    }
    const today = new Date();
    if (!nextPlace?.start_hour) return "";
    const [sh, sm] = nextPlace.start_hour.split(":").map(Number);
    const minutesBetween = sh * 60 + sm - (today.getHours() * 60 + today.getMinutes());
    const M = Math.abs(minutesBetween % 60);
    const H = Math.floor(Math.abs(minutesBetween) / 60);
    return `Queda${H === 1 || (H === 0 && M === 1) ? "" : "n"} ${H ? `${H} hora${H === 1 ? "" : "s"}` : ""}${
      H && M ? " y " : " "
    }${M ? `${M} minuto${M === 1 ? "" : "s"}` : ""} para la proxima actividad`;
  };

  // Build markers from currentTrip.places (normalize lat/lng/title/images)
  const markers =
    currentTrip && Array.isArray(currentTrip.places)
      ? currentTrip.places
          .map((p) => {
            const loc = p.location || {};
            const lat =
              loc.latitude !== undefined
                ? Number(loc.latitude)
                : loc.latitud !== undefined
                ? Number(loc.latitud)
                : loc.lat !== undefined
                ? Number(loc.lat)
                : null;
            const lng =
              loc.longitude !== undefined
                ? Number(loc.longitude)
                : loc.longitud !== undefined
                ? Number(loc.longitud)
                : loc.lon !== undefined
                ? Number(loc.lon)
                : loc.lng !== undefined
                ? Number(loc.lng)
                : null;
            const title = loc.title ?? loc.titulo ?? loc.name ?? "";
            const imgs = safeParseImages(loc.images ?? loc.imagenes);
            return {
              place: p,
              latitude: lat,
              longitude: lng,
              title,
              images: imgs,
            };
          })
          .filter((m) => m.latitude != null && m.longitude != null)
      : null;

  const getLat = (loc) =>
    Number(loc.latitude ?? loc.lat ?? loc.latitud ?? loc.latitud_local ?? NaN) || NaN;
  const getLng = (loc) =>
    Number(loc.longitude ?? loc.lon ?? loc.longitud ?? loc.longitud_local ?? NaN) || NaN;

  // Filter popular to avoid duplicates with trip markers
  const filteredPopular = markers
    ? popular.filter((pop) => {
        const popLat = getLat(pop);
        const popLng = getLng(pop);
        return !markers.some(
          (m) =>
            Math.abs(Number(m.latitude) - popLat) < 0.0001 &&
            Math.abs(Number(m.longitude) - popLng) < 0.0001
        );
      })
    : popular;

  // page blocking while loading essential data
  if (loadingTrips || loadingCurrent || loadingPopular) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <div className="muted" style={{ fontSize: "25px", alignSelf: "center" }}>
          Cargando viajes…
        </div>
      </div>
    );
  }

  return (
    <div className="home-root">
      <Header />

      <main className="hero">
        <div className="hero-left">
          <div style={{ marginTop: currentPlace && nextPlace ? "20px" : "", marginBottom: currentPlace && nextPlace ? "40px" : "" }}>
            <div>
              <h1 style={{ margin: 0 }}>
                {currentTrip
                  ? `Estas en ${currentTrip.destination}`
                  : nextTrip
                  ? `Próximo viaje: ${nextTrip.destination}`
                  : "Lista para tu próxima aventura?"}
              </h1>
              <p className="hero-sub" style={{ marginBottom: 0 }}>
                {nextTrip ? `${fmtDate(nextTrip.start_date)} — ${fmtDate(nextTrip.end_date)}` : "Crea un viaje y te ayudamos a planear el itinerario automáticamente."}
              </p>
              <div className="home-actions">
                {nextTrip && (
                  <button className="btn-ghost" onClick={() => navigate(`/trip_itinerary/${nextTrip.id}`)}>
                    Ver itinerario
                    <div>▶</div>
                  </button>
                )}
              </div>
            </div>

            {currentPlace || nextPlace ? (
              <div>
                {currentPlace && (
                  <div className="hero-box" style={{ marginTop: "20px" }}>
                    <h3 style={{ margin: 0, marginBottom: "10px" }}>Actividad actual:</h3>

                    <button
                      className="place-row"
                      onClick={() => {
                        if (currentPlace && currentPlace.location) {
                          const lat = Number(currentPlace.location.latitude ?? currentPlace.location.lat ?? currentPlace.location.latitud);
                          const lng = Number(currentPlace.location.longitude ?? currentPlace.location.lon ?? currentPlace.location.longitud);
                          if (!isNaN(lat) && !isNaN(lng)) {
                            setViewState({
                              latitude: lat,
                              longitude: lng,
                              zoom: 16,
                            });
                          } else {
                            console.warn("⚠️ Coordenadas inválidas en currentPlace:", currentPlace.location);
                          }
                        }
                      }}
                    >
                      {currentPlace.location?.imagenes && (
                        <OptimizedImage
                          src={pickBestImage(safeParseImages(currentPlace.location?.images ?? currentPlace.location?.imagenes))}
                          alt={currentPlace.location?.title ?? currentPlace.location?.titulo ?? "Lugar actual"}
                          width={120}
                          height={80}
                          priority={true}
                        />
                      )}
                      <div className="place-info">
                        <h2>{currentPlace.location?.title ?? currentPlace.location?.titulo}</h2>
                        <p className="sub-title">{fmtDate(currentPlace.date)}</p>
                        <p className="sub-title">{fmtHour(currentPlace.start_hour)} - {fmtHour(currentPlace.end_hour)}</p>
                        {currentPlace.notes && <p>Notas: {currentPlace.notes}</p>}
                        <p className="sub-title">{hasNextToday ? timeBetween() : "Esta es la última actividad del día"}</p>
                      </div>
                    </button>
                  </div>
                )}

                {nextPlace && (
                  <div className="hero-box" style={{ marginTop: "20px" }}>
                    <h3 style={{ margin: "0", marginBottom: "10px" }}>Próxima actividad:</h3>
                    <button
                      className="place-row"
                      onClick={() => {
                        if (nextPlace && nextPlace.location) {
                          const lat = Number(nextPlace.location.latitude ?? nextPlace.location.lat ?? nextPlace.location.latitud);
                          const lng = Number(nextPlace.location.longitude ?? nextPlace.location.lon ?? nextPlace.location.longitud);
                          if (!isNaN(lat) && !isNaN(lng)) {
                            setViewState({
                              latitude: lat,
                              longitude: lng,
                              zoom: 16,
                            });
                          } else {
                            console.warn("⚠️ Coordenadas inválidas en nextPlace:", nextPlace.location);
                          }
                        }
                      }}
                    >
                      {nextPlace.location?.imagenes && (
                        <OptimizedImage
                          src={pickBestImage(safeParseImages(nextPlace.location?.images ?? nextPlace.location?.imagenes))}
                          alt={nextPlace.location?.title ?? nextPlace.location?.titulo ?? "Próximo lugar"}
                          width={120}
                          height={80}
                        />
                      )}
                      <div className="place-info">
                        <h2>{nextPlace.location?.title ?? nextPlace.location?.titulo}</h2>
                        <p>{fmtDate(nextPlace.date)}</p>
                        <p>{fmtHour(nextPlace.start_hour)} - {fmtHour(nextPlace.end_hour)}</p>
                        {nextPlace.notes && <p>Notas: {nextPlace.notes}</p>}
                      </div>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {!nextPlace && currentTrip ? (
                  <div className="muted">No tienes mas actividades en este viaje. Agrega uno nuevo </div>
                ) : (
                  <div>
                    <section className="hero-box" style={{ marginTop: "30px", paddingTop: 0 }}>
                      <h3 style={{ marginBottom: 10 }}>Tus viajes</h3>
                      {trips.length === 0 ? (
                        <div className="muted">No tienes viajes. Empieza creando uno 😉</div>
                      ) : (
                        <div className="trips-preview">
                          {trips.slice(0, 4).map((t) => (
                            <button key={t.id} className="trip-card" onClick={() => navigate(`/trip_itinerary/${t.id}`)}>
                              <div className="trip-card-left">
                                <div className="trip-destination">{t.destination}</div>
                                <div className="trip-dates">{fmtDate(t.start_date)} — {fmtDate(t.end_date)}</div>
                              </div>
                              <div className="trip-card-right">▶</div>
                            </button>
                          ))}
                          {trips.length > 4 && (
                            <button className="see-all" onClick={() => navigate("/trips")}>Ver todos</button>
                          )}
                        </div>
                      )}
                    </section>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="hero-right">
          {currentTrip ? (
            <div style={{ flex: 1, marginTop: 20 }}>
              <Map
                {...viewState}
                onMove={(evt) => setViewState(evt.viewState)}
                style={{ flex: 1, marginTop: 20, background: "#ddd", height: "500px" }}
                mapStyle="mapbox://styles/mapbox/streets-v11"
                mapboxAccessToken={MAPBOX_TOKEN}
              >
                <NavigationControl position="top-right" />
                {markers &&
                  markers.map((m) => {
                    const isCurrent = currentPlace && m.place.id === currentPlace.id;
                    const isNext = nextPlace && m.place.id === nextPlace.id;
                    let fillColor = "#ff3951";
                    let sizeMarker = "24";
                    if (isCurrent) {
                      fillColor = "#9b30ff";
                      sizeMarker = "30";
                    } else if (isNext) {
                      fillColor = "#00cc66";
                      sizeMarker = "30";
                    }

                    return (
                      <Marker key={`m-${m.place.id}`} longitude={Number(m.longitude)} latitude={Number(m.latitude)} anchor="bottom">
                        <div
                          onMouseEnter={() =>
                            setSelectedLocationOnMap({
                              latitude: m.latitude,
                              longitude: m.longitude,
                              titulo: m.title,
                              interes: "",
                              date: m.place.date,
                              startHour: m.place.start_hour,
                              endHour: m.place.end_hour,
                              image: pickBestImage(m.images),
                            })
                          }
                          onMouseLeave={() => setSelectedLocationOnMap(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewState((v) => ({
                              ...v,
                              latitude: Number(m.latitude),
                              longitude: Number(m.longitude),
                              zoom: 16,
                            }));
                          }}
                        >
                          <svg width={sizeMarker} height={sizeMarker} viewBox="0 0 24 24" style={{ transform: "translate(-12px,-24px)", cursor: "pointer" }} xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill={fillColor} />
                            <circle cx="12" cy="9" r="2.5" fill="#fff" />
                          </svg>
                        </div>
                      </Marker>
                    );
                  })}

                {filteredPopular.map((m) => {
                  // normalize lat/lng & image/title
                  const lat = getLat(m);
                  const lng = getLng(m);
                  const title = m.title ?? m.titulo ?? m.name ?? "";
                  const imgs = safeParseImages(m.images ?? m.imagenes);
                  const imgThumb = pickBestImage(imgs);
                  return (
                    <Marker key={`m-${m.id}`} longitude={Number(lng)} latitude={Number(lat)} anchor="bottom">
                      <div
                        onMouseEnter={() =>
                          setSelectedLocationOnMap({
                            latitude: lat,
                            longitude: lng,
                            titulo: title,
                            interes: m.interest ?? m.fk_interest ?? m.category ?? "",
                            date: "",
                            startHour: "",
                            endHour: "",
                            image: imgThumb,
                          })
                        }
                        onMouseLeave={() => setSelectedLocationOnMap(null)}
                        onClick={(e) => {
                          e.originalEvent && e.originalEvent.stopPropagation();
                          setViewState((v) => ({
                            ...v,
                            latitude: Number(lat),
                            longitude: Number(lng),
                            zoom: 16,
                          }));
                        }}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" style={{ transform: "translate(-12px,-24px)", cursor: "pointer" }} xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="blue" />
                          <circle cx="12" cy="9" r="2.5" fill="#fff" />
                        </svg>
                      </div>
                    </Marker>
                  );
                })}

                {selectedLocationOnMap && (
                  <Popup longitude={Number(selectedLocationOnMap.longitude)} latitude={Number(selectedLocationOnMap.latitude)} anchor="bottom" closeButton={false} offset={[-12, -53]}>
                    <div className="place-popUp">
                      {selectedLocationOnMap.image && (
                        <OptimizedImage
                          src={selectedLocationOnMap.image}
                          alt={selectedLocationOnMap.titulo}
                          width={150}
                          height={100}
                        />
                      )}
                      <div className="place-info">
                        <h3>{selectedLocationOnMap.titulo}</h3>
                        {selectedLocationOnMap.interes && <p>{selectedLocationOnMap.interes}</p>}
                        {selectedLocationOnMap.date && <p>{fmtDate(selectedLocationOnMap.date)}</p>}
                        {selectedLocationOnMap.startHour && <p>{fmtHour(selectedLocationOnMap.startHour)} - {fmtHour(selectedLocationOnMap.endHour)}</p>}
                      </div>
                    </div>
                  </Popup>
                )}

                <div className="map-legend">
                  <table>
                    <tbody>
                      <tr>
                        <td>
                          <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#9b30ff" />
                            <circle cx="12" cy="9" r="2.5" fill="#fff" />
                          </svg>
                        </td>
                        <td>Actividad actual</td>
                      </tr>
                      <tr>
                        <td>
                          <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#00cc66" />
                            <circle cx="12" cy="9" r="2.5" fill="#fff" />
                          </svg>
                        </td>
                        <td>Próxima actividad</td>
                      </tr>
                      <tr>
                        <td>
                          <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ff3951" />
                            <circle cx="12" cy="9" r="2.5" fill="#fff" />
                          </svg>
                        </td>
                        <td>Otros lugares del viaje</td>
                      </tr>
                      <tr>
                        <td>
                          <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="blue" />
                            <circle cx="12" cy="9" r="2.5" fill="#fff" />
                          </svg>
                        </td>
                        <td>Lugares populares</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Map>
            </div>
          ) : (
            <div>
              <h3 style={{ marginTop: 0 }}>Lugares recomendados</h3>

              <div className="carousel">
                <div className="carousel-inner" style={{ transform: `translateX(-${index * 100}%)` }}>
                  {popular.length === 0 ? (
                    <div className="carousel-item empty">No hay lugares para mostrar</div>
                  ) : (
                    popular.map((loc) => {
                      const imgs = safeParseImages(loc.images ?? loc.imagenes);
                      const thumb = pickBestImage(imgs);
                      const title = loc.title ?? loc.titulo ?? loc.name ?? "—";
                      const interest = loc.interest ?? loc.fk_interest ?? loc.category ?? "";
                      return (
                        <div className="carousel-item" key={loc.id} onClick={() => navigate(`/locations/${loc.id}`)}>
                          <div className="carousel-image">
                            {!thumb ? (
                              <div className="no-img">No image</div>
                            ) : (
                              <OptimizedImage src={thumb} alt={title} width={400} height={260} />
                            )}
                          </div>
                          <div className="carousel-body">
                            <div className="carousel-title">{title}</div>
                            <div className="carousel-sub">{interest}</div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {popular.length > 1 && (
                  <>
                    <button className="carousel-nav left" onClick={goPrev}>
                      ‹
                    </button>
                    <button className="carousel-nav right" onClick={goNext}>
                      ›
                    </button>
                    <div className="carousel-dots">
                      {popular.map((_, i) => (
                        <button key={i} className={`dot ${i === index ? "active" : ""}`} onClick={() => setIndex(i)} aria-label={`Go to ${i + 1}`} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {!currentTrip && (
          <div className="trips-cta">
            <button className="btn-newtrip" onClick={() => navigate("/add-trip")}>
              Nuevo Viaje &nbsp; &gt;
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
