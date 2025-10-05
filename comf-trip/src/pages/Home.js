// src/pages/Home.jsx
import React, {useEffect, useState, useRef} from "react";
import { useNavigate } from "react-router-dom";
import "../styles/home.css";

import Header from "../components/Header";
import { apiGet } from "./api";

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
                    if(pDate>todayDate) return true
                }
                const [sh, sm] = p.start_hour.split(":").map(Number);
                const startMinutes = sh * 60 + sm;

                return nowMinutes < startMinutes;
            });
            setNextPlace(placeNext || null);
            if(!placeNext) setHasNextToday(false);
            setLoadingCurrent(false);
        }

        // primera ejecución inmediata
        updateStatus();


        // volver a chequear cada minuto
        const interval = setInterval(updateStatus, 60 * 1000);

        return () => clearInterval(interval);
    }, [nextTrip]);



    return (
    <div className="home-root">
      <Header />

      <main className="hero">
        <div className="hero-left">
            {loadingTrips || loadingCurrent ? (
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
                        <h2>Actividad actual:</h2>
                        <div className="place-row" style={{backgroundColor:"#fff6f7"}}>
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
                            </div>
                        </div>
                        <p className="sub-title">
                            {hasNextToday ? "" : "Esta es la última actividad del día"}
                        </p>
                    </div>
                )}
                    {nextPlace && (
                        <div>
                            <h2>Próxima actividad:</h2>
                            <div className="place-row">
                                <img
                                    src={safeParseImages(nextPlace.location?.imagenes)[0]}
                                    className="place-img"
                                    alt="Próximo lugar"
                                />
                                <div className="place-info">
                                    <h3>{nextPlace.location?.titulo}</h3>
                                    <p>
                                        {fmtDate(nextPlace.date)}
                                    </p>
                                    <p>
                                        {fmtHour(nextPlace.start_hour)} - {fmtHour(nextPlace.end_hour)}
                                    </p>
                                </div>
                            </div>
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
          </div>
        </div>
      </main>
    </div>
  );
}
