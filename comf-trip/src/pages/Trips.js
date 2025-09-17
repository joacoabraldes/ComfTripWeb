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

  const isCurrentTrip = (trip) => {
    if (!trip.start_date || !trip.end_date) return false;
    const today = new Date();
    const start = new Date(trip.start_date);
    const end = new Date(trip.end_date);
    return today >= start && today <= end;
  };

  const fmtDate = (d) => {
    if (!d) return "-";
    try {
      const date = new Date(d);
      return date.toLocaleDateString();
    } catch (e) {
      return d;
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await apiGet("/trips");
        if (!mounted) return;
        if (Array.isArray(res)) {
          // ordenar → viajes actuales primero
          const sorted = [...res].sort((a, b) => {
            const aNow = isCurrentTrip(a);
            const bNow = isCurrentTrip(b);
            if (aNow && !bNow) return -1;
            if (!aNow && bNow) return 1;
            return new Date(b.start_date) - new Date(a.start_date); // fallback por fecha
          });

          setTrips(sorted);
          setSelectedTrip(sorted.length ? sorted[0] : null);
        } else {
          setTrips([]);
          setSelectedTrip(null);
        }
      } catch (err) {
        console.error("Error cargando viajes:", err);
        setTrips([]);
        setSelectedTrip(null);
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
                <MapSvg width={799} height={600} />
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
                              {fmtDate(t.start_date || t.startDate)} —{" "}
                              {fmtDate(t.end_date || t.endDate)}
                            </div>
                            {selectedTrip?.budget != null && (
                                <p className="trip-detail-row">
                                  <strong>Presupuesto:</strong> ${selectedTrip.budget}
                                </p>
                            )}
                            {selectedTrip?.notes && (
                                <p className="trip-detail-row">
                                  <strong>Notas:</strong> {selectedTrip.notes}
                                </p>
                            )}
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
                                  <button className="trip-menu-btn"
                                      onClick={() => {
                                        navigate(`/trips/${t.id}/editTrip`);
                                        setMenuOpen(null);
                                      }}
                                  ><svg width="20" height="20" viewBox="0 0 41 37" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M18.7915 6.16667H6.83317C5.92701 6.16667 5.05797 6.49152 4.41722 7.06975C3.77647 7.64799 3.4165 8.43225 3.4165 9.25V30.8333C3.4165 31.6511 3.77647 32.4353 4.41722 33.0136C5.05797 33.5918 5.92701 33.9167 6.83317 33.9167H30.7498C31.656 33.9167 32.525 33.5918 33.1658 33.0136C33.8065 32.4353 34.1665 31.6511 34.1665 30.8333V20.0417M31.604 3.85417C32.2836 3.24085 33.2054 2.8963 34.1665 2.8963C35.1276 2.8963 36.0494 3.24085 36.729 3.85417C37.4086 4.46748 37.7904 5.29931 37.7904 6.16667C37.7904 7.03402 37.4086 7.86585 36.729 8.47917L20.4998 23.125L13.6665 24.6667L15.3748 18.5L31.604 3.85417Z" stroke="#1E1E1E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                  </button>
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
                                    <path d="M5.625 10.75H9.375M9.375 10.75H39.375M9.375 10.75V35.8333C9.375 36.7837 9.77009 37.6951 10.4733 38.3671C11.1766 39.0391 12.1304 39.4167 13.125 39.4167H31.875C32.8696 39.4167 33.8234 39.0391 34.5266 38.3671C35.2299 37.6951 35.625 36.7837 35.625 35.8333V10.75M15 10.75V7.16667C15 6.21631 15.3951 5.30487 16.0984 4.63287C16.8016 3.96086 17.7554 3.58333 18.75 3.58333H26.25C27.2446 3.58333 28.1984 3.96086 28.9016 4.63287C29.6049 5.30487 30 6.21631 30 7.16667V10.75M18.75 19.7083V30.4583M26.25 19.7083V30.4583" stroke="#1E1E1E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
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
