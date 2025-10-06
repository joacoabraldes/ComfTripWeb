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

  // try to obtain current user id from a JWT stored in localStorage.token (best-effort)
  const getCurrentUserId = () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload && (payload.id || payload.userId || payload.sub || payload.user_id) ? Number(payload.id || payload.userId || payload.sub || payload.user_id) : null;
    } catch (e) {
      return null;
    }
  };

  const currentUserId = getCurrentUserId();

  const normalizeDate = (d) => {
    if (!d) return new Date();
    const date = d.split("T")[0].split("-");
    const yy = Number(date[0]);
    const mm = Number(date[1]) - 1;
    const dd = Number(date[2]);
    return new Date(yy, mm, dd);
  };

  const fmtDate = (d) => {
    if (!d) return "-";
    const date = d.split("T")[0].split("-");
    const yy = date[0];
    const mm = date[1];
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
        } else {
          // backend returned something unexpected — set trips empty
          setTrips([]);
        }
      } catch (err) {
        console.error("Error cargando viajes:", err);
        alert("No se pudo cargar los viajes");
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
                {trips.map((t) => {
                  const isOwner = currentUserId ? Number(t.user_id) === Number(currentUserId) : null;
                  return (
                    <div
                      key={t.id}
                      className={`trips-list-item ${selectedTrip && selectedTrip.id === t.id ? "active" : ""}`}
                      role="listitem"
                    >
                      {/* Texto a la izquierda */}
                      <div
                        className="trip-item-main"
                        onClick={() => navigate(`/trip_itinerary/${t.id}`)}
                      >
                        <div className="trip-destination">
                          {t.destination ?? "Destino desconocido"}

                          {/* shared / created badge */}
                          {t.share ? (
                            <span className="badge badge-primary" style={{ marginLeft: 8 }}>
                              {t.share.public ? "Enlace público" : "Compartido"}
                              {t.share.mode ? ` (${t.share.mode})` : ""}
                            </span>
                          ) : isOwner ? (
                            <span className="badge badge-secondary" style={{ marginLeft: 8 }}>
                              Creado por ti
                            </span>
                          ) : null}
                        </div>

                        <div className="trip-dates">
                          {fmtDate(t.start_date)} — {fmtDate(t.end_date)}
                        </div>

                        <div className="trip-created">
                          Creado: {fmtDate(t.created_at)}
                        </div>
                      </div>

                      {/* Botón menú (⋮) */}
                      <div className="trip-menu-wrapper">
                        <button
                          className="trip-menu-btn"
                          onClick={() => setMenuOpen(menuOpen === t.id ? null : t.id)}
                        >
                          ⋮
                        </button>

                        {menuOpen === t.id && (
                          <div className="trip-menu">
                            <button
                              className="trip-menu-btn"
                              onClick={async () => {
                                try {
                                  // call backend share endpoint - backend returns { url, share }
                                  const token = localStorage.getItem("token");
                                  const res = await fetch(`/api/trips/${t.id}/share`, {
                                    method: "POST",
                                    headers: {
                                      "Content-Type": "application/json",
                                      ...(token ? { Authorization: `Bearer ${token}` } : {})
                                    },
                                    body: JSON.stringify({ mode: "viewer", public: false })
                                  });
                                  if (!res.ok) {
                                    const errText = await res.text().catch(()=>null);
                                    throw new Error(errText || `HTTP ${res.status}`);
                                  }
                                  const data = await res.json();
                                  setMenuOpen(null);

                                  if (navigator.share && data?.url) {
                                    await navigator.share({
                                      title: "Mi viaje",
                                      text: `Mira mi viaje a ${t.destination}`,
                                      url: data.url,
                                    });
                                  } else if (data?.url) {
                                    // copy to clipboard if available
                                    try {
                                      await navigator.clipboard.writeText(data.url);
                                      alert("Enlace copiado al portapapeles");
                                    } catch (_) {
                                      window.prompt("Copia este enlace para compartir:", data.url);
                                    }
                                  } else {
                                    alert("Enlace generado (pero no se recibió URL del servidor).");
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

                            <button
                              className="trip-menu-btn"
                              onClick={async () => {
                                if (window.confirm(`¿Seguro que deseas eliminar el viaje a ${t.destination}?`)) {
                                  try {
                                    await apiDelete(`/trips/${t.id}`);
                                    setTrips((prev) => prev.filter((trip) => trip.id !== t.id)); // refresca la lista
                                    setMenuOpen(null);
                                  } catch (err) {
                                    console.error("Error eliminando viaje:", err);
                                    alert("No se pudo eliminar el viaje.");
                                  }
                                }
                              }}
                            >🗑
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
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
