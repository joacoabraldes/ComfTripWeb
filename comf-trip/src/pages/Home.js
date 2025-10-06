// src/pages/Home.jsx
import React, {useEffect, useState, useRef} from "react";
import { useNavigate } from "react-router-dom";
import "../styles/home.css";
import Header from "../components/Header";
import { apiGet } from "./api";
import Map, {Marker, NavigationControl, Popup} from "react-map-gl/mapbox";
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
        // data is an array of trips (your controller returns trips for authenticated user)
        setTrips(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Home: fetch trips error", err);
        setTrips([]);
      } finally {
        if (mounted) setLoadingTrips(false);
      }
    })();
    return () => { mounted = false; };
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
    return () => { mounted = false; };
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
        if(!d) return "-"
        const date=d.split("T")[0].split("-");
        const yy = date[0];
        const mm =date[1];
        const dd = date[2];
        return `${dd}/${mm}/${yy}`;
    };

    const fmtHour=(t)=>{
        if(!t) return "-";
        const time=t.split(":");
        const hour=time[0];
        const min=time[1];
        return `${hour}:${min}`
    }

  function goPrev() {
    setIndex((i) => (i - 1 + carouselLen) % carouselLen);
  }
  function goNext() {
    setIndex((i) => (i + 1) % carouselLen);
  }

  const upcoming = trips
    .filter(t => t.start_date) // keep those with dates
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  const nextTrip = upcoming.length ? upcoming[0] : null;

    const normalizeDate=(d)=>{
        if(!d) return new Date();
        const date=d.split("T")[0].split("-");
        const yy = Number(date[0]);
        const mm =Number(date[1])-1;
        const dd = Number(date[2]);
        return new Date(yy, mm, dd);
    }

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

    const [currentTrip, setCurrentTrip]=useState(null);
    const [currentPlace, setCurrentPlace]=useState(null);
    const [nextPlace, setNextPlace]=useState(null);
    const [hasNextToday, setHasNextToday]=useState(true);
    const [loadingCurrent, setLoadingCurrent]=useState(true);
    // map viewport (centered on first place or default)
    const [viewState, setViewState] = useState({
        latitude: -34.6037,
        longitude: -58.3816,
        zoom: 11
    });
    const [selectedLocationOnMap, setSelectedLocationOnMap] = useState(null);
    useEffect(() => {
        function updateStatus() {
            const now = new Date();
            const currentDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            // Determinar si estamos en un viaje actual
            const tripNow =
                nextTrip &&
                normalizeDate(nextTrip.start_date) <= currentDay &&
                normalizeDate(nextTrip.end_date) >= currentDay ? nextTrip : null;

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

                const [sh, sm] = p.start_hour.split(":").map(Number);
                const [eh, em] = p.end_hour.split(":").map(Number);

                const startMinutes = sh * 60 + sm;
                const endMinutes = eh * 60 + em;

                return nowMinutes >= startMinutes && nowMinutes <= endMinutes;
            });

            setCurrentPlace(placeNow || null);

            const placeNext = tripNow.places.find((p) => {
                const pDate = normalizeDate(p.date).getTime();
                if (pDate !== todayDate){
                    setHasNextToday(false);
                    return pDate>todayDate;
                }
                const [sh, sm] = p.start_hour.split(":").map(Number);
                const startMinutes = sh * 60 + sm;
                setHasNextToday(true);
                return nowMinutes < startMinutes;
            });
            setNextPlace(placeNext || null);
            if(!placeNext) setHasNextToday(false);

        }

        // primera ejecución inmediata
        updateStatus();


        // volver a chequear cada minuto
        const interval = setInterval(updateStatus, 60 * 1000);
        setLoadingCurrent(false);
        return () => clearInterval(interval);
    }, [nextTrip]);

    const timeBetween=()=>{
        if(!hasNextToday) return "";
        if(currentPlace){
            const [sh, sm] = nextPlace.start_hour.split(":").map(Number);
            const [eh, em] = currentPlace.end_hour.split(":").map(Number);

            const minutesBetween =(sh * 60 + sm)-(eh * 60 + em);
            const M=minutesBetween%60;
            const H=(minutesBetween-M)/60;
            if(!H && !M){
                return "La proxima actividad comenzara apenas termime la actual"
            }
            return `Al terminar la actividad quedara${H===1 || (H===0 && M===1)? "":"n"} ${H ? `${H} hora${H===1? "":"s"}` : ""}
            ${H&&M ? " y ":" "}${M ? `${M} minuto${M===1? "":"s"}` : ""} para la proxima actividad`
        }
        const today=new Date();
        const [sh, sm] = nextPlace.start_hour.split(":").map(Number);

        const minutesBetween =(sh * 60 + sm)-(today.getHours() * 60 + today.getMinutes());
        const M=minutesBetween%60;
        const H=(minutesBetween-M)/60;
        return `Queda${H===1 || (H===0 && M===1)? "":"n"} ${H ? `${H} hora${H===1? "":"s"}` : ""}${H&&M ? " y ":" "}
        ${M ? `${M} minuto${M===1? "":"s"}` : ""} para la proxima actividad`

    }

    const markers = (currentTrip ? (currentTrip.places)
        .map((p) => {
            const loc = p.location || {};
            const lat = loc.latitude !== undefined ? Number(loc.latitude) : (loc.latitud !== undefined ? Number(loc.latitud) : null);
            const lng = loc.longitude !== undefined ? Number(loc.longitude) : (loc.longitud !== undefined ? Number(loc.longitud) : null);
            return {
                place: p,
                latitude: lat,
                longitude: lng,
                title: loc.titulo,
                images:loc.imagenes
            };
        })
        .filter(m => m.latitude != null && m.longitude != null) : null);

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



    return (
    <div className="home-root">
      <Header />

      <main className="hero">
        <div className="hero-left">
            {(loadingTrips || loadingCurrent) ? (
                <div className="muted" style={{fontSize:"25px"}}>Cargando viajes…</div>
            ) :(<div>
          <div className="hero-top">

            <h1 style={{ margin: 0 }}>
              {currentTrip ? `Estas en ${currentTrip.destination}` : (nextTrip ? `Próximo viaje: ${nextTrip.destination}` : "Lista para tu próxima aventura?")}
            </h1>
            <p className="hero-sub" style={{ marginBottom: 0 }}>
              {nextTrip
                ? `${fmtDate(nextTrip.start_date)} — ${fmtDate(nextTrip.end_date)}`
                : "Crea un viaje y te ayudamos a planear el itinerario automáticamente."}
            </p>
              <div className="home-actions" >
                  {nextTrip && (
                      <button className="btn-ghost" onClick={() => navigate(`/trip_itinerary/${nextTrip.id}`)}>
                          Ver itinerario<div>
                          ▶
                      </div>
                      </button>
                  )}
              </div>
          </div>
            {currentPlace || nextPlace ? (
                <div>{currentPlace && (
                    <div style={{ paddingBottom: "5px" }}>
                        <h3>Actividad actual:</h3>
                        <button className="place-row"
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
                                            console.warn("⚠️ Coordenadas inválidas en nextPlace:", currentPlace.location);
                                        }
                                    }
                                }}>
                            <img
                                src={safeParseImages(currentPlace.location?.imagenes)[0]}
                                className="place-img"
                                alt="Lugar actual"
                            />
                            <div className="place-info">
                                <h2>{currentPlace.location?.titulo}</h2>
                                <p className="sub-title">
                                    {fmtDate(currentPlace.date)}
                                </p>
                                <p className="sub-title">
                                    {fmtHour(currentPlace.start_hour)} - {fmtHour(currentPlace.end_hour)}
                                </p>
                                {currentPlace.notes && (<p>
                                        Notas: {currentPlace.notes}
                                    </p>)}
                            </div>
                        </button>

                    </div>
                )}<p className="sub-title">
                    {hasNextToday ? timeBetween() : "Esta es la última actividad del día"}
                </p>
                    {nextPlace && (
                        <div>
                            <h3>Próxima actividad:</h3>
                            <button className="place-row"
                                    onClick={() => {
                                        if (nextPlace && nextPlace.location) {
                                            const lat = Number(nextPlace.location.latitude ?? nextPlace.location.latitud);
                                            const lng = Number(nextPlace.location.longitude ?? nextPlace.location.longitud);
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
                                    }}>
                                <img
                                    src={safeParseImages(nextPlace.location?.imagenes)[0]}
                                    className="place-img"
                                    alt="Próximo lugar"
                                />
                                <div className="place-info">
                                    <h2>{nextPlace.location?.titulo}</h2>
                                    <p>
                                        {fmtDate(nextPlace.date)}
                                    </p>
                                    <p>
                                        {fmtHour(nextPlace.start_hour)} - {fmtHour(nextPlace.end_hour)}
                                    </p>
                                    {nextPlace.notes && (<p>
                                        Notas: {nextPlace.notes}
                                    </p>)}
                                </div>
                            </button>
                        </div>
                    )}

                </div>
            ) : (
                <div>
          <section style={{ marginTop: 22 }}>
            <h3 style={{ marginBottom: 10 }}>Tus viajes</h3>
              { trips.length === 0 ? (
              <div className="muted">No tienes viajes. Empieza creando uno 😉</div>
            ) : (
              <div className="trips-preview">
                {trips.slice(0, 4).map((t) => (
                  <button
                    key={t.id}
                    className="trip-card"
                    onClick={() => navigate(`/trip_itinerary/${t.id}`)}
                  >
                    <div className="trip-card-left">
                      <div className="trip-destination">{t.destination}</div>
                      <div className="trip-dates">{fmtDate(t.start_date)} — {fmtDate(t.end_date)}</div>
                    </div>
                    <div className="trip-card-right">
                      ▶
                    </div>
                  </button>
                ))}
                {trips.length > 4 && (
                  <button className="see-all" onClick={() => navigate("/trips")}>Ver todos</button>
                )}
              </div>
            )}<button className="btn-primary" onClick={() => navigate("/add-trip")}>Nuevo viaje</button>
          </section>
            </div>)}</div>)}
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
                        {markers.map((m) => {
                            const isCurrent = currentPlace && m.place.id === currentPlace.id;
                            const isNext = nextPlace && m.place.id === nextPlace.id;

                            // elegir color según tipo
                            let fillColor = "#ff3951"; // rojo por defecto
                            let sizeMarker="24";
                            if (isCurrent) {fillColor = "#9b30ff";// violeta
                                sizeMarker="30";}
                            else if (isNext) {fillColor = "#00cc66"; // verde
                                sizeMarker="30";}

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
                                                interes:"",
                                                date: m.place.date,
                                                startHour: m.place.start_hour,
                                                endHour: m.place.end_hour,
                                                image: safeParseImages(m.images)[0]
                                            })
                                        }
                                        onMouseLeave={() => setSelectedLocationOnMap(null)}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setViewState((v) => ({
                                                ...v,
                                                latitude: Number(m.latitude),
                                                longitude: Number(m.longitude),
                                                zoom: 16
                                            }));
                                        }}
                                    >
                                        <svg
                                            width={sizeMarker}
                                            height={sizeMarker}
                                            viewBox="0 0 24 24"
                                            style={{ transform: "translate(-12px,-24px)", cursor: "pointer" }}
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
                                anchor="bottom">
                                <div
                                    onMouseEnter={() =>
                                        setSelectedLocationOnMap({
                                            latitude: m.latitude,
                                            longitude: m.longitude,
                                            titulo: m.titulo,
                                            interes:m.fk_interest,
                                            date: "",
                                            startHour:"",
                                            endHour:"",
                                            image: safeParseImages(m.imagenes)[0]
                                        })
                                    }
                                    onMouseLeave={() => setSelectedLocationOnMap(null)}
                                    onClick={(e) => {
                                        e.originalEvent && e.originalEvent.stopPropagation();
                                        setViewState((v) => ({ ...v, latitude: Number(m.latitude), longitude: Number(m.longitude), zoom: 16 }));
                                    }}
                                >
                                    <svg
                                        width="24"
                                        height="24"
                                        viewBox="0 0 24 24"
                                        style={{ transform: "translate(-12px,-24px)", cursor: "pointer" }}
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="blue" />
                                        <circle cx="12" cy="9" r="2.5" fill="#fff" />
                                    </svg></div>
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
                                    <img
                                        src={selectedLocationOnMap.image}
                                        className="img-popUp"
                                        alt="Lugar actual"
                                    />
                                    <div className="place-info">
                                        <h3>{selectedLocationOnMap.titulo}</h3>
                                        {selectedLocationOnMap && (<p>
                                            {selectedLocationOnMap.interes}
                                        </p>)}
                                        {selectedLocationOnMap.date && (<p>
                                            {fmtDate(selectedLocationOnMap.date)}
                                        </p>)}
                                        {selectedLocationOnMap.startHour && (
                                        <p>
                                            {fmtHour(selectedLocationOnMap.startHour)} - {fmtHour(selectedLocationOnMap.endHour)}
                                        </p>)}
                                    </div>
                                </div>
                            </Popup>
                        )}
                        <div className="map-legend">
                            <table>
                                <tbody>
                                <tr>
                                    <td><svg
                                        width="24"
                                        height="24"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#9b30ff" />
                                        <circle cx="12" cy="9" r="2.5" fill="#fff" />
                                    </svg></td>
                                    <td>Actividad actual</td>
                                </tr>
                                <tr>
                                    <td><svg
                                        width="24"
                                        height="24"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#00cc66" />
                                        <circle cx="12" cy="9" r="2.5" fill="#fff" />
                                    </svg></td>
                                    <td>Próxima actividad</td>
                                </tr>
                                <tr>
                                    <td><svg
                                        width="24"
                                        height="24"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ff3951" />
                                        <circle cx="12" cy="9" r="2.5" fill="#fff" />
                                    </svg></td>
                                    <td>Otros lugares del viaje</td>
                                </tr>
                                <tr>
                                    <td><svg
                                        width="24"
                                        height="24"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="blue" />
                                        <circle cx="12" cy="9" r="2.5" fill="#fff" />
                                    </svg></td>
                                    <td>Lugares populares</td>
                                </tr>
                                </tbody>
                            </table>
                        </div>

                    </Map>
                </div>)
                : (<div>
          <h3 style={{ marginTop: 0 }}>Lugares recomendados</h3>

          <div className="carousel">
            <div className="carousel-inner" style={{ transform: `translateX(-${index * 100}%)` }}>
              {loadingPopular ? (
                <div className="carousel-item empty">Cargando lugares…</div>
              ) : popular.length === 0 ? (
                <div className="carousel-item empty">No hay lugares para mostrar</div>
              ) : (
                popular.map((loc) => {
                  const imgs = (() => {
                    try {
                      if (!loc.imagenes) return [];
                      if (Array.isArray(loc.imagenes)) return loc.imagenes;
                      return JSON.parse(loc.imagenes);
                    } catch (e) {
                      return typeof loc.imagenes === "string" ? loc.imagenes.split(",") : [];
                    }
                  })();
                  const img = imgs && imgs.length ? imgs[0] : null;
                  return (
                    <div className="carousel-item" key={loc.id} onClick={() => navigate(`/locations/${loc.id}`)}>
                      <div className="carousel-image" style={{ backgroundImage: img ? `url(${img})` : undefined }}>
                        {!img && <div className="no-img">No image</div>}
                      </div>
                      <div className="carousel-body">
                        <div className="carousel-title">{loc.titulo}</div>
                        <div className="carousel-sub">{loc.fk_interest}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {popular.length > 1 && (
              <>
                <button className="carousel-nav left" onClick={goPrev}>‹</button>
                <button className="carousel-nav right" onClick={goNext}>›</button>
                <div className="carousel-dots">
                  {popular.map((_, i) => (
                    <button
                      key={i}
                      className={`dot ${i === index ? "active" : ""}`}
                      onClick={() => setIndex(i)}
                      aria-label={`Go to ${i+1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div></div>)}
        </div>
      </main>
    </div>
  );
}
