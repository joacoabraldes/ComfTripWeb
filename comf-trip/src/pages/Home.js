// src/pages/Home.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FaCalendar, FaMapMarkerAlt, FaClock } from "react-icons/fa";
import { Country, City } from "country-state-city";
import "../styles/home.css";
import { apiGet } from "./api";
import Map, { Marker, NavigationControl, Popup } from "react-map-gl/mapbox";
import { useTranslation } from "../i18n";
import { formatDate, isTripCurrent, normalizeDate } from "../utils/dateUtils";
import LoadingSpinner from "../components/LoadingSpinner";
const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || "";

export default function Home() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [trips, setTrips] = useState([]);
  const [popular, setPopular] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [loadingPopular, setLoadingPopular] = useState(true);

  const carouselLen = popular.length;

  // carousel state (infinite loop with clones)
  const [carouselIndex, setCarouselIndex] = useState(0); // includes clones
  const [isCarouselAnimating, setIsCarouselAnimating] = useState(false);
  const [withCarouselTransition, setWithCarouselTransition] = useState(true);
  const carouselIndexRef = useRef(0);
  const carouselAutoRef = useRef(null);
  const CAROUSEL_ANIMATION_MS = 280;

  const [currentTrip, setCurrentTrip] = useState(null);

  // keep ref in sync with state
  useEffect(() => {
    carouselIndexRef.current = carouselIndex;
  }, [carouselIndex]);

  // reset index whenever data changes
  useEffect(() => {
    if (carouselLen > 1) {
      // start at first *real* slide (index 1 in the extended array)
      setCarouselIndex(1);
      carouselIndexRef.current = 1;
    } else {
      // 0 or 1 slide → no clones
      setCarouselIndex(0);
      carouselIndexRef.current = 0;
    }
  }, [carouselLen]);

  // re-enable transition after a "jump" (when looping around)
  useEffect(() => {
    if (!withCarouselTransition) {
      const id = requestAnimationFrame(() => {
        setWithCarouselTransition(true);
      });
      return () => cancelAnimationFrame(id);
    }
  }, [withCarouselTransition]);

  // fetch user's trips
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingTrips(true);
      try {
        const data = await apiGet("/trips");
        if (!mounted) return;
        // data is an array of trips (your controller returns trips for authenticated user)
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

  // fetch popular locations (top by relevancia)
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingPopular(true);
      try {
        // tu endpoint /locations acepta limit y ya ordena por relevancia en el controller
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
    if (carouselAutoRef.current) clearInterval(carouselAutoRef.current);

    carouselAutoRef.current = setInterval(() => {
      if (carouselLen <= 1) return;
      setIsCarouselAnimating(true);
      setWithCarouselTransition(true);
      setCarouselIndex((prev) => prev + 1);
    }, 4000);

    return () => {
      if (carouselAutoRef.current) clearInterval(carouselAutoRef.current);
    };
  }, [carouselLen]);

  const fmtHour = (timeStr) => {
    if (!timeStr) return "-";
    const time = timeStr.split(":");
    const hour = time[0];
    const min = time[1];
    return `${hour}:${min}`;
  };

  function goPrev() {
    if (carouselLen <= 1 || isCarouselAnimating) return;
    setIsCarouselAnimating(true);
    setWithCarouselTransition(true);
    setCarouselIndex((prev) => (carouselLen > 1 ? prev - 1 : 0));
  }

  function goNext() {
    if (carouselLen <= 1 || isCarouselAnimating) return;
    setIsCarouselAnimating(true);
    setWithCarouselTransition(true);
    setCarouselIndex((prev) => (carouselLen > 1 ? prev + 1 : 0));
  }

  const handleCarouselTransitionEnd = () => {
    if (carouselLen <= 1) {
      setIsCarouselAnimating(false);
      return;
    }

    setIsCarouselAnimating(false);
    const current = carouselIndexRef.current;

    // if we moved onto the "fake" slide after the last, jump back to first real
    if (current === carouselLen + 1) {
      setWithCarouselTransition(false);
      const target = 1;
      setCarouselIndex(target);
      carouselIndexRef.current = target;
    }
    // if we moved onto the "fake" slide before the first, jump to last real
    else if (current === 0) {
      setWithCarouselTransition(false);
      const target = carouselLen;
      setCarouselIndex(target);
      carouselIndexRef.current = target;
    }
  };

  const upcoming = trips
    .filter((trip) => trip.start_date) // keep those with dates
    .sort((a, b) => normalizeDate(a.start_date) - normalizeDate(b.start_date));

  const today = new Date();

  const nextTrip = upcoming.find(
    (tri) =>
      isTripCurrent(tri.start_date, tri.end_date) ||
      normalizeDate(tri.start_date) > today
  );

  const safeParseImages = (im) => {
    if (!im) return [];
    if (Array.isArray(im)) return im;
    if (typeof im === "string") {
      try {
        const parsed = JSON.parse(im);
        if (Array.isArray(parsed)) return parsed;
        return [parsed];
      } catch (e) {
        return [im];
      }
    }
    return [];
  };

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

      // Determinar si estamos en un viaje actual
      const tripNow =
        nextTrip && isTripCurrent(nextTrip.start_date, nextTrip.end_date)
          ? nextTrip
          : null;

      setCurrentTrip(tripNow);

      if (!tripNow) {
        setCurrentPlace(null);
        return;
      }

      // Calcular si estamos en un place en este momento
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const todayDate = currentDay.getTime();

      const placeNow = tripNow.places.find((p) => {
        const pDate = normalizeDate(p.date).getTime();
        if (pDate !== todayDate) return false;
        if (!p.start_hour && !p.end_hour) return true;
        const [sh, sm] = p.start_hour.split(":").map(Number);
        const [eh, em] = p.end_hour.split(":").map(Number);

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
        if (!p.start_hour) return true;
        const [sh, sm] = p.start_hour.split(":").map(Number);
        const startMinutes = sh * 60 + sm;
        setHasNextToday(true);
        return nowMinutes < startMinutes;
      });
      setNextPlace(placeNext || null);
      if (!placeNext) setHasNextToday(false);
    }

    // primera ejecución inmediata
    updateStatus();

    // volver a chequear cada minuto
    const interval = setInterval(updateStatus, 60 * 1000);
    setLoadingCurrent(false);
    return () => clearInterval(interval);
  }, [nextTrip, trips]);

  useEffect(() => {
    if (!currentTrip) return;

    (async () => {
      try {
        const destination = currentTrip.destination || "";
        const [cityRaw, countryRaw] = destination.split(",").map((s) => s.trim());
        if (!cityRaw || !countryRaw) return;

        const normalize = (s) =>
          s
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();

        console.log("Buscando coordenadas para:", cityRaw, countryRaw);

        // Buscar país (tolerante a diferencias de nombre)
        const country = Country.getAllCountries().find(
          (c) =>
            normalize(c.name) === normalize(countryRaw) ||
            normalize(c.name).includes(normalize(countryRaw)) ||
            normalize(countryRaw).includes(normalize(c.name))
        );

        if (!country) {
          console.warn("País no encontrado:", countryRaw);
          return;
        }

        console.log("País encontrado:", country.name, country.isoCode);

        const cities = City.getCitiesOfCountry(country.isoCode);
        const match = cities.find(
          (c) =>
            normalize(c.name) === normalize(cityRaw) ||
            normalize(c.name).includes(normalize(cityRaw)) ||
            normalize(cityRaw).includes(normalize(c.name))
        );

        if (!match) {
          console.warn(`Ciudad "${cityRaw}" no encontrada en ${country.name}`);
          console.log("Ejemplos:", cities.slice(0, 10).map((c) => c.name));
          return;
        }

        console.log("Ciudad encontrada:", match.name, match.latitude, match.longitude);

        setViewState({
          latitude: Number(match.latitude),
          longitude: Number(match.longitude),
          zoom: 13,
        });
      } catch (err) {
        console.error("Error obteniendo coordenadas:", err);
      }
    })();
  }, [currentTrip]);

  const timeBetween = () => {
    if (!hasNextToday) return "";
    if (currentPlace) {
      if (!nextPlace.start_hour && !currentPlace.end_hour) return "";
      const [sh, sm] = nextPlace.start_hour.split(":").map(Number);
      const [eh, em] = currentPlace.end_hour.split(":").map(Number);

      const minutesBetween = sh * 60 + sm - (eh * 60 + em);
      const M = minutesBetween % 60;
      const H = (minutesBetween - M) / 60;
      if (!H && !M) {
        return t("home.nextActivityStarts");
      }
      const hoursStr = H ? `${H} ${H === 1 ? t("home.hour") : t("home.hours")}` : "";
      const minutesStr = M ? `${M} ${M === 1 ? t("home.minute") : t("home.minutes")}` : "";
      const plural = H === 1 || (H === 0 && M === 1) ? "" : "n";
      return t("home.timeUntilNext", {
        plural,
        hours: hoursStr,
        minutes: minutesStr,
        and: H && M ? t("home.and") : " ",
      });
    }
    const today = new Date();
    if (!nextPlace.start_hour) return "";
    const [sh, sm] = nextPlace.start_hour.split(":").map(Number);

    const minutesBetween =
      sh * 60 + sm - (today.getHours() * 60 + today.getMinutes());
    const M = minutesBetween % 60;
    const H = (minutesBetween - M) / 60;
    const hoursStr = H ? `${H} ${H === 1 ? t("home.hour") : t("home.hours")}` : "";
    const minutesStr = M ? `${M} ${M === 1 ? t("home.minute") : t("home.minutes")}` : "";
    const plural = H === 1 || (H === 0 && M === 1) ? "" : "n";
    return t("home.timeUntilNextNoCurrent", {
      plural,
      hours: hoursStr,
      minutes: minutesStr,
      and: H && M ? t("home.and") : " ",
    });
  };

  const markers = currentTrip
    ? currentTrip.places
        .map((p) => {
          const loc = p.location || {};
          const lat =
            loc.latitude !== undefined
              ? Number(loc.latitude)
              : loc.latitud !== undefined
              ? Number(loc.latitud)
              : null;
          const lng =
            loc.longitude !== undefined
              ? Number(loc.longitude)
              : loc.longitud !== undefined
              ? Number(loc.longitud)
              : null;
          return {
            place: p,
            latitude: lat,
            longitude: lng,
            title: loc.title || loc.titulo,
            images: loc.images || loc.imagenes,
          };
        })
        .filter((m) => m.latitude != null && m.longitude != null)
    : null;

  // Evitar mostrar lugares populares que ya están en los markers del viaje actual
  const filteredPopular = markers
    ? popular.filter((pop) => {
        // Convertir a números (por si vienen como string)
        const popLat = Number(pop.latitude);
        const popLng = Number(pop.longitude);

        // Si algún marker del viaje tiene coordenadas iguales, lo excluimos
        return !markers.some(
          (m) =>
            Math.abs(Number(m.latitude) - popLat) < 0.0001 &&
            Math.abs(Number(m.longitude) - popLng) < 0.0001
        );
      })
    : popular;

  if (loadingTrips || loadingCurrent || loadingPopular) {
    return (
      <div className="home-root">
        <LoadingSpinner message={t("common.loading")} fullScreen />
      </div>
    );
  }

  return (
    <div className="home-root">
      <main className="hero">
        <div className="hero-left">
          <div
            style={{
              marginTop: currentPlace && nextPlace ? "1.25rem" : "",
              marginBottom: currentPlace && nextPlace ? "2.5rem" : "",
            }}
          >
            <div>
              <h1 style={{ margin: 0 }}>
                {currentTrip
                  ? t("home.currentTrip", { destination: currentTrip.destination })
                  : nextTrip
                  ? t("home.nextTrip", { destination: nextTrip.destination })
                  : t("home.readyForAdventure")}
              </h1>
              <div style={{ display: "flex", alignItems: "center", marginTop: 20 }}>
                <FaCalendar
                  size={18}
                  color="#8a6b80"
                  style={{ marginRight: 8, marginBottom: 4 }}
                />
                <p className="hero-sub" style={{ margin: 0 }}>
                  {nextTrip
                    ? `${formatDate(nextTrip.start_date)} — ${formatDate(
                        nextTrip.end_date
                      )}`
                    : t("home.createTripHelp")}
                </p>
              </div>

              <div className="home-actions">
                {nextTrip && (
                  <button
                    className="btn-ghost"
                    onClick={() => navigate(`/trip_itinerary/${nextTrip.id}`)}
                  >
                    {t("home.viewItinerary")}
                    <div>▶</div>
                  </button>
                )}
              </div>
            </div>
            {currentPlace || nextPlace ? (
              <div>
                {currentPlace && (
                  <div>
                    <div
                      style={{
                        background: "#ff3951",
                        height: "0.125rem",
                        marginBottom: "1.875rem",
                        marginTop: "1.875rem",
                      }}
                    ></div>
                    <h3 style={{ margin: 0, marginBottom: "0.625rem" }}>
                      {t("home.currentActivity")}
                    </h3>
                    <button
                      className="place-row"
                      onClick={() => {
                        if (currentPlace && currentPlace.location) {
                          const lat = Number(currentPlace.location.latitude);
                          const lng = Number(currentPlace.location.longitude);
                          if (!isNaN(lat) && !isNaN(lng)) {
                            setViewState({
                              latitude: lat,
                              longitude: lng,
                              zoom: 16,
                            });
                          } else {
                            console.warn(
                              "Coordenadas inválidas en nextPlace:",
                              currentPlace.location
                            );
                          }
                        }
                      }}
                    >
                      {(currentPlace.location?.images ||
                        currentPlace.location?.imagenes) && (
                        <img
                          src={
                            safeParseImages(
                              currentPlace.location?.images ||
                                currentPlace.location?.imagenes
                            )[0]
                          }
                          className="place-img"
                          alt={t("home.currentPlace")}
                        />
                      )}
                      <div className="place-info">
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <FaMapMarkerAlt
                            size={25}
                            color="#ff3951"
                            style={{ marginRight: 12 }}
                          />
                          <h2>{currentPlace.location?.titulo}</h2>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            marginTop: 10,
                          }}
                        >
                          <FaCalendar
                            size={18}
                            color="#8a6b80"
                            style={{ marginRight: 8, marginBottom: 10 }}
                          />{" "}
                          <p className="sub-title">
                            {" "}
                            {formatDate(currentPlace.date)}{" "}
                          </p>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            marginTop: 10,
                          }}
                        >
                          <FaClock
                            size={18}
                            color="#8a6b80"
                            style={{ marginRight: 8, marginBottom: 10 }}
                          />{" "}
                          <p className="sub-title">
                            {" "}
                            {fmtHour(currentPlace.start_hour)} -{" "}
                            {fmtHour(currentPlace.end_hour)}{" "}
                          </p>
                        </div>
                        {currentPlace.notes && (
                          <p>
                            {t("home.notes")} {currentPlace.notes}
                          </p>
                        )}
                        <p className="sub-title">
                          {hasNextToday
                            ? timeBetween()
                            : t("home.lastActivityOfDay")}
                        </p>
                      </div>
                    </button>
                  </div>
                )}
                {nextPlace && (
                  <div>
                    <div
                      style={{
                        background: "#ff3951",
                        height: 2,
                        marginBottom: 30,
                        marginTop: 30,
                      }}
                    ></div>
                    <h3 style={{ margin: "0", marginBottom: "0.625rem" }}>
                      {t("home.nextActivity")}
                    </h3>
                    <button
                      className="place-row"
                      onClick={() => {
                        if (nextPlace && nextPlace.location) {
                          const lat = Number(
                            nextPlace.location.latitude ??
                              nextPlace.location.latitud
                          );
                          const lng = Number(
                            nextPlace.location.longitude ??
                              nextPlace.location.longitud
                          );
                          if (!isNaN(lat) && !isNaN(lng)) {
                            setViewState({
                              latitude: lat,
                              longitude: lng,
                              zoom: 16,
                            });
                          } else {
                            console.warn(
                              "Coordenadas inválidas en nextPlace:",
                              nextPlace.location
                            );
                          }
                        }
                      }}
                    >
                      {(nextPlace.location?.images ||
                        nextPlace.location?.imagenes) && (
                        <img
                          src={
                            safeParseImages(
                              nextPlace.location?.images ||
                                nextPlace.location?.imagenes
                            )[0]
                          }
                          className="place-img"
                          alt={t("home.nextPlace")}
                        />
                      )}
                      <div className="place-info">
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <FaMapMarkerAlt
                            size={25}
                            color="#ff3951"
                            style={{ marginRight: 12 }}
                          />
                          <h2>{nextPlace.location?.titulo}</h2>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            marginTop: 10,
                          }}
                        >
                          <FaCalendar
                            size={18}
                            color="#8a6b80"
                            style={{ marginRight: 8, marginBottom: 10 }}
                          />
                          <p> {formatDate(nextPlace.date)} </p>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            marginTop: 10,
                          }}
                        >
                          <FaClock
                            size={18}
                            color="#8a6b80"
                            style={{ marginRight: 8, marginBottom: 10 }}
                          />
                          <p>
                            {" "}
                            {fmtHour(nextPlace.start_hour)} -{" "}
                            {fmtHour(nextPlace.end_hour)}{" "}
                          </p>
                        </div>
                        {nextPlace.notes && (
                          <p>
                            {t("home.notes")} {nextPlace.notes}
                          </p>
                        )}
                      </div>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {!nextPlace && currentTrip ? (
                  <div className="muted">{t("home.noMoreActivities")}</div>
                ) : (
                  <div>
                    <div
                      style={{
                        background: "#ff3951",
                        height: 2,
                        marginBottom: 30,
                        marginTop: 30,
                      }}
                    ></div>
                    <h3 style={{ marginBottom: 10 }}>{t("home.yourTrips")}</h3>
                    {trips.length === 0 ? (
                      <div className="muted">{t("home.noTrips")}</div>
                    ) : (
                      <div className="trips-preview">
                        {trips.slice(0, 4).map((t) => (
                          <button
                            key={t.id}
                            className="trip-card"
                            onClick={() => navigate(`/trip_itinerary/${t.id}`)}
                          >
                            <div className="trip-card-left">
                              <div className="trip-destination">
                                {t.destination}
                              </div>
                              <div className="trip-dates">
                                {formatDate(t.start_date)} —{" "}
                                {formatDate(t.end_date)}
                              </div>
                            </div>
                            <div className="trip-card-right">▶</div>
                          </button>
                        ))}
                        {trips.length > 4 && (
                          <button
                            className="see-all"
                            onClick={() => navigate("/trips")}
                          >
                            {t("home.viewAll")}
                          </button>
                        )}
                      </div>
                    )}
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
                style={{
                  flex: 1,
                  marginTop: 20,
                  background: "#ddd",
                  height: "110%",
                }}
                mapStyle="mapbox://styles/mapbox/streets-v11"
                mapboxAccessToken={MAPBOX_TOKEN}
              >
                <NavigationControl position="top-right" />
                {markers.map((m) => {
                  const isCurrent =
                    currentPlace && m.place.id === currentPlace.id;
                  const isNext = nextPlace && m.place.id === nextPlace.id;

                  // elegir color según tipo
                  let fillColor = "#ff3951"; // rojo por defecto
                  let sizeMarker = "24";
                  if (isCurrent) {
                    fillColor = "#9b30ff"; // violeta
                    sizeMarker = "30";
                  } else if (isNext) {
                    fillColor = "#00cc66"; // verde
                    sizeMarker = "30";
                  }

                  return (
                    <Marker
                      key={`m-${m.place.id}`}
                      longitude={Number(m.longitude)}
                      latitude={Number(m.latitude)}
                      anchor="bottom"
                    >
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
                            image: safeParseImages(m.images)[0],
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
                        <svg
                          width={sizeMarker}
                          height={sizeMarker}
                          viewBox="0 0 24 24"
                          style={{
                            transform: "translate(-0.75rem,-1.5rem)",
                            cursor: "pointer",
                          }}
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                            fill={fillColor}
                          />
                          <circle cx="12" cy="9" r="2.5" fill="#fff" />
                        </svg>
                      </div>
                    </Marker>
                  );
                })}

                {filteredPopular.map((m) => (
                  <Marker
                    key={`m-${m.id}`}
                    longitude={Number(m.longitude)}
                    latitude={Number(m.latitude)}
                    anchor="bottom"
                  >
                    <div
                      onMouseEnter={() =>
                        setSelectedLocationOnMap({
                          latitude: m.latitude,
                          longitude: m.longitude,
                          titulo: m.title || m.titulo,
                          interes: m.fk_interest,
                          date: "",
                          startHour: "",
                          endHour: "",
                          image: safeParseImages(m.images || m.imagenes)[0],
                        })
                      }
                      onMouseLeave={() => setSelectedLocationOnMap(null)}
                      onClick={(e) => {
                        e.originalEvent && e.originalEvent.stopPropagation();
                        setViewState((v) => ({
                          ...v,
                          latitude: Number(m.latitude),
                          longitude: Number(m.longitude),
                          zoom: 16,
                        }));
                      }}
                    >
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        style={{
                          transform: "translate(-12px,-24px)",
                          cursor: "pointer",
                        }}
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                          fill="blue"
                        />
                        <circle cx="12" cy="9" r="2.5" fill="#fff" />
                      </svg>
                    </div>
                  </Marker>
                ))}

                {selectedLocationOnMap && (
                  <Popup
                    longitude={Number(selectedLocationOnMap.longitude)}
                    latitude={Number(selectedLocationOnMap.latitude)}
                    anchor="bottom"
                    closeButton={false}
                    offset={[-12, -53]}
                  >
                    <div className="place-popUp">
                      {selectedLocationOnMap.image && (
                        <img
                          src={selectedLocationOnMap.image}
                          className="img-popUp"
                          alt={t("home.currentPlace")}
                        />
                      )}
                      <div className="place-info">
                        <h3>{selectedLocationOnMap.titulo}</h3>
                        {selectedLocationOnMap && (
                          <p>{selectedLocationOnMap.interes}</p>
                        )}
                        {selectedLocationOnMap.date && (
                          <p>{formatDate(selectedLocationOnMap.date)}</p>
                        )}
                        {selectedLocationOnMap.startHour && (
                          <p>
                            {fmtHour(selectedLocationOnMap.startHour)} -{" "}
                            {fmtHour(selectedLocationOnMap.endHour)}
                          </p>
                        )}
                      </div>
                    </div>
                  </Popup>
                )}
                <div className="map-legend">
                  <table>
                    <tbody>
                      <tr>
                        <td>
                          <svg
                            width="24"
                            height="24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                              fill="#9b30ff"
                            />
                            <circle cx="12" cy="9" r="2.5" fill="#fff" />
                          </svg>
                        </td>
                        <td>{t("home.currentActivityLegend")}</td>
                      </tr>
                      <tr>
                        <td>
                          <svg
                            width="24"
                            height="24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                              fill="#00cc66"
                            />
                            <circle cx="12" cy="9" r="2.5" fill="#fff" />
                          </svg>
                        </td>
                        <td>{t("home.nextActivityLegend")}</td>
                      </tr>
                      <tr>
                        <td>
                          <svg
                            width="24"
                            height="24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                              fill="#ff3951"
                            />
                            <circle cx="12" cy="9" r="2.5" fill="#fff" />
                          </svg>
                        </td>
                        <td>{t("home.otherPlaces")}</td>
                      </tr>
                      <tr>
                        <td>
                          <svg
                            width="24"
                            height="24"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                              fill="blue"
                            />
                            <circle cx="12" cy="9" r="2.5" fill="#fff" />
                          </svg>
                        </td>
                        <td>{t("home.popularLocationsLegend")}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Map>
            </div>
          ) : (
            <div>
              <h3 style={{ marginTop: 0 }}>{t("home.recommendedPlaces")}</h3>

              <div className="carousel">
                {carouselLen === 0 ? (
                  <div className="carousel-inner">
                    <div className="carousel-item empty">
                      {t("home.noPlacesToShow")}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* build array with clones: [last, ...popular, first] */}
                    <div
                      className="carousel-inner"
                      style={{
                        transform: `translateX(-${carouselIndex * 100}%)`,
                        transition: withCarouselTransition
                          ? `transform ${CAROUSEL_ANIMATION_MS}ms ease-out`
                          : "none",
                        willChange: "transform",
                      }}
                      onTransitionEnd={handleCarouselTransitionEnd}
                    >
                      {(carouselLen > 1
                        ? [popular[carouselLen - 1], ...popular, popular[0]]
                        : popular
                      ).map((loc, idx) => {
                        const imgs = safeParseImages(
                          loc.images || loc.imagenes
                        );
                        const img = imgs && imgs.length ? imgs[0] : null;
                        const title = loc.title || loc.titulo;
                        const desc =
                          loc.description ||
                          loc.descripcion ||
                          t("home.noDescription");

                        return (
                          <div
                            className="carousel-item"
                            key={`${loc.id}-${idx}`}
                            onClick={() => navigate(`/locations/${loc.id}`)}
                          >
                            <div className="carousel-image">
                              {!img ? (
                                <div className="no-img">
                                  {t("home.noImage")}
                                </div>
                              ) : (
                                <img
                                  src={img}
                                  alt={title}
                                  loading="lazy"
                                  decoding="async"
                                  className="carousel-img"
                                />
                              )}
                            </div>
                            <div className="carousel-body">
                              <div className="carousel-title">{title}</div>
                              <div className="carousel-sub">{desc}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {carouselLen > 1 && (
                      <>
                        <button
                          className="carousel-nav left"
                          onClick={goPrev}
                          disabled={isCarouselAnimating}
                        >
                          ‹
                        </button>
                        <button
                          className="carousel-nav right"
                          onClick={goNext}
                          disabled={isCarouselAnimating}
                        >
                          ›
                        </button>

                        {/* dots: active index is (carouselIndex - 1) in the real array */}
                        <div className="carousel-dots">
                          {popular.map((_, i) => {
                            const activeIndex =
                              carouselLen > 1
                                ? (carouselIndex - 1 + carouselLen) %
                                  carouselLen
                                : 0;
                            return (
                              <button
                                key={i}
                                className={`dot ${
                                  i === activeIndex ? "active" : ""
                                }`}
                                onClick={() => {
                                  if (carouselLen <= 1) return;
                                  setWithCarouselTransition(true);
                                  setIsCarouselAnimating(true);
                                  setCarouselIndex(i + 1); // +1 because of leading clone
                                }}
                                aria-label={t("common.goTo", {
                                  number: i + 1,
                                })}
                              />
                            );
                          })}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
        {!currentTrip && (
          <div className="trips-cta">
            <button
              className="btn-newtrip"
              onClick={() => navigate("/add-trip")}
            >
              {t("trips.newTrip")}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
