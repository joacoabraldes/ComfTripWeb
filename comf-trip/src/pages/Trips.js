import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MapSvg from "../components/MapSvg";
import "../styles/trips.css";
import Header from "../components/Header";
import "../styles/header.css";
import { apiGet, apiDelete } from "./api";

export default function Trips() {
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null); // id del menú abierto
  const navigate = useNavigate();

  const normalizeDate=(d)=>{
      if(!d) return new Date();
      const date=d.split("T")[0].split("-");
      const yy = Number(date[0]);
      const mm =Number(date[1])-1;
      const dd = Number(date[2]);
      return new Date(yy, mm, dd);
  }

  const fmtDate = (d) => {
      if(!d) return "-"
      const date=d.split("T")[0].split("-");
      const yy = date[0];
      const mm =date[1];
      const dd = date[2];
      return `${dd}/${mm}/${yy}`;
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await apiGet("/trips");
        const isCurrentTrip = (trip) => {
            if (!trip.start_date || !trip.end_date) return false;
            const today = new Date();
            const start = normalizeDate(trip.start_date);
            const end = normalizeDate(trip.end_date);
            return today >= start && today <= end;
        };

        if (!mounted) return;
        if (Array.isArray(res)) {
          // ordenar → viajes actuales primero
          const sorted = [...res].sort((a, b) => {
            const aNow = isCurrentTrip(a);
            const bNow = isCurrentTrip(b);
            if (aNow && !bNow) return -1;
            if (!aNow && bNow) return 1;
            return normalizeDate(b.start_date) - normalizeDate(a.start_date); // fallback por fecha
          });
          setTrips(sorted);
          setSelectedTrip(sorted.length ? sorted[0] : null);
        }
      } catch (err) {
        console.error("Error cargando viajes:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);


  // pantalla de carga
  if (loading) {
    return (
        <div className="trips-root">
          <Header />
          <main className="trips-main">
            <section className="trips-left">
              <div className="trips-message">Cargando viajes…</div>
            </section>
            <section className="trips-right">
              <div className="map-wrapper" aria-hidden>
                <MapSvg width={999} height={800} />
              </div>
            </section>
          </main>
        </div>
    );
  }

  return (
      <div className="trips-root">
        <Header />

        <main className="trips-main">
          <section className="trips-left">
            {trips.length === 0 ? (
                <div className="trips-message">
                  No tienes ningún viaje activo actualmente
                  <br />
                  ¡Planea tu siguiente viaje!
                </div>
            ) : (
                <>
                  <h3 className="trips-list-title">Tus viajes</h3>

                  <div className="trips-list" role="list">
                    {trips.map((t) => (
                        <div
                            key={t.id}
                            className={`trips-list-item ${
                                selectedTrip && selectedTrip.id === t.id ? "active" : ""
                            }`}
                            role="listitem"
                        >
                          {/* Texto a la izquierda */}
                          <div
                              className="trip-item-main"
                              onClick={() => navigate(`/trip_itinerary/${t.id}`)}
                          >
                            <div className="trip-destination">
                              {t.destination ?? "Destino desconocido"}
                            </div>
                            <div className="trip-dates">
                              {fmtDate(t.start_date)} —{" "}
                              {fmtDate(t.end_date)}
                            </div>
                            {/*{t?.budget != null && (*/}
                            {/*    <p className="trip-detail-row">*/}
                            {/*      <strong>Presupuesto:</strong> ${t.budget}*/}
                            {/*    </p>*/}
                            {/*)}*/}
                            {/*{t?.notes && (*/}
                            {/*    <p className="trip-detail-row">*/}
                            {/*      <strong>Notas:</strong> {t.notes}*/}
                            {/*    </p>*/}
                            {/*)}*/}
                            <div className="trip-created">
                              Creado: {fmtDate(t.created_at)}
                            </div>
                          </div>


                          {/* Botón menú (⋮) */}
                          <div className="trip-menu-wrapper">
                            <button
                                className="trip-menu-btn"
                                onClick={() =>
                                    setMenuOpen(menuOpen === t.id ? null : t.id)
                                }
                            >⋮
                            </button>

                            {menuOpen === t.id && (
                                <div className="trip-menu">
                                  <button
                                    className="trip-menu-btn"
                                    onClick={async () => {
                                      try {
                                        const res = await fetch(`/api/trips/${t.id}/share`, {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json", 
                                                    Authorization: `Bearer ${localStorage.getItem("token")}` }
                                        });
                                        const data = await res.json();
                                        setMenuOpen(null);

                                        if (navigator.share) {
                                          await navigator.share({
                                            title: "Mi viaje",
                                            text: `Mira mi viaje a ${t.destination}`,
                                            url: data.url,
                                          });
                                        } else {
                                          window.prompt("Copia este enlace para compartir:", data.url);
                                        }
                                      } catch (err) {
                                        console.error("Error generando enlace de compartir:", err);
                                        alert("No se pudo generar el enlace de compartir.");
                                      }
                                    }}
                                  >
                                    {/* ícono de compartir */}
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                      <path d="M4 12V19C4 19.55 4.45 20 5 20H19C19.55 20 20 19.55 20 19V12"
                                            stroke="#1E1E1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                      <path d="M12 4V15M12 4L8 8M12 4L16 8"
                                            stroke="#1E1E1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                  </button>

                                    <button className="trip-menu-btn"
                                            onClick={() => {navigate(`/edit-trip/${t.id}`)
                                                setMenuOpen(null)
                                            }}
                                    >✎</button>

                                  <button className="trip-menu-btn"
                                          onClick={async () => {
                                            if (window.confirm(`¿Seguro que deseas eliminar el viaje a ${t.destination}?`)) {
                                              try {
                                                await apiDelete(`/trips/${t.id}`);
                                                setTrips((prev) => prev.filter((trip) => trip.id !== t.id)); // 👈 refresca la lista
                                                setMenuOpen(null);
                                              } catch (err) {
                                                console.error("Error eliminando viaje:", err);
                                                alert("No se pudo eliminar el viaje.");
                                              }
                                            }
                                          }}
                                  ><svg width="20" height="20" viewBox="0 0 45 43" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M5.625 10.75H9.375M9.375 10.75H39.375M9.375 10.75V35.8333C9.375 36.7837 9.77009 37.6951 10.4733 38.3671C11.1766 39.0391 12.1304 39.4167 13.125 39.4167H31.875C32.8696 39.4167 33.8234 39.0391 34.5266 38.3671C35.2299 37.6951 35.625 36.7837 35.625 35.8333V10.75M15 10.75V7.16667C15 6.21631 15.3951 5.30487 16.0984 4.63287C16.8016 3.96086 17.7554 3.58333 18.75 3.58333H26.25C27.2446 3.58333 28.1984 3.96086 28.9016 4.63287C29.6049 5.30487 30 6.21631 30 7.16667V10.75M18.75 19.7083V30.4583M26.25 19.7083V30.4583" stroke="#1E1E1E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>

                                  </button>
                                </div>
                            )}
                          </div>
                        </div>
                    ))}
                  </div>

                </>
            )}
          </section>

          <section className="trips-right">
            {trips.length === 0 ? (
                <div className="map-wrapper" aria-hidden>
                  <MapSvg width={999} height={800} />
                </div>
            ) : (
                <>
                  <div style={{ padding: 12 }}>
                    <div className="map-wrapper" aria-hidden>
                      <MapSvg width={999} height={800} />
                    </div>
                  </div>
                </>
            )}
          </section>

          {/* CTA abajo */}
          <div className="trips-cta">
            <button
                className="btn-newtrip"
                onClick={() => navigate("/add-trip")}
            >
              Nuevo Viaje &nbsp; &gt;
            </button>
          </div>
        </main>
      </div>
  );
}
