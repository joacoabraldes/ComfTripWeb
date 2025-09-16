// src/pages/Trips.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MapSvg from "../components/MapSvg";
import "../styles/trips.css";
import Hamburger from "../components/icons/Hamburger";
import UserIcon from "../components/icons/UserIcon";
import Sidebar from "../components/Sidebar";
import { apiGet } from "./api";

export default function Trips() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const navigate = useNavigate();

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
          setTrips(res);
          setSelectedTrip(res.length ? res[0] : null);
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
    return () => { mounted = false; };
  }, []);

  // loading screen (small)
  if (loading) {
    return (
      <div className="trips-root">
        <Sidebar open={menuAbierto} onClose={() => setMenuAbierto(false)} />
        <div className="home-header">
          <button className="icon-btn icon-left" aria-label="menu" onClick={() => setMenuAbierto(!menuAbierto)}>
            <Hamburger />
          </button>
          <button className="icon-btn icon-right" aria-label="profile" onClick={() => navigate("/profile")}>
            <UserIcon />
          </button>
        </div>

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
      <Sidebar open={menuAbierto} onClose={() => setMenuAbierto(false)} />

      <div className="home-header">
        <button className="icon-btn icon-left" aria-label="menu" onClick={() => setMenuAbierto(!menuAbierto)}>
          <Hamburger />
        </button>
        <button className="icon-btn icon-right" aria-label="profile" onClick={() => navigate("/profile")}>
          <UserIcon />
        </button>
      </div>

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
                  <button
                    key={t.id}
                    type="button"
                    className={`trips-list-item ${selectedTrip && selectedTrip.id === t.id ? "active" : ""}`}
                    onClick={() => navigate(`/trip_itinerary/${t.id}`)}
                    role="listitem"
                  >
                    <div className="trip-item-main">
                      <div className="trip-destination">{t.destination ?? t.destino ?? "Destino desconocido"}</div>
                      <div className="trip-dates">{fmtDate(t.start_date || t.startDate)} — {fmtDate(t.end_date || t.endDate)}</div>
                    </div>
                    <div className="trip-created">Creado: {fmtDate(t.created_at)}</div>
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 12 }}>
                <button className="btn-newtrip small" onClick={() => navigate("/add-trip")}>
                  Nuevo Viaje &nbsp; &gt;
                </button>
              </div>
            </>
          )}
        </section>

        <section className="trips-right">
          {trips.length === 0 ? (
            <div className="map-wrapper" aria-hidden>
              <MapSvg width={799} height={600} />
            </div>
          ) : (
            <>
              <div className="trip-detail">
                <h2>{selectedTrip?.destination ?? selectedTrip?.destino ?? "Destino"}</h2>
                <p className="trip-detail-row"><strong>Fechas:</strong> {fmtDate(selectedTrip?.start_date)} — {fmtDate(selectedTrip?.end_date)}</p>
                {selectedTrip?.budget != null && <p className="trip-detail-row"><strong>Presupuesto:</strong> ${selectedTrip.budget}</p>}
                {selectedTrip?.notes && <p className="trip-detail-row"><strong>Notas:</strong> {selectedTrip.notes}</p>}

                <div className="trip-actions">
                  <button onClick={() => navigate(`/trips/${selectedTrip.id}`)}>Ver viaje</button>
                  <button onClick={() => navigate(`/trips/${selectedTrip.id}/edit`)}>Editar</button>
                </div>
              </div>

              <div style={{ padding: 12 }}>
                <div className="map-wrapper" aria-hidden>
                  <MapSvg width={799} height={400} />
                </div>
              </div>
            </>
          )}
        </section>
      </main>

      {/* bottom CTA, centered but not overlapping content */}
      <div className="trips-cta">
        <button className="btn-newtrip" onClick={() => navigate("/add-trip")}>Nuevo Viaje &nbsp; &gt;</button>
      </div>
    </div>
  );
}
