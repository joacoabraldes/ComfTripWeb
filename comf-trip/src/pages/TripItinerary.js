// src/pages/TripItinerary.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MapSvg from "../components/MapSvg";
import "../styles/tripItinerary.css";
import Sidebar from "../components/Sidebar";
import Hamburger from "../components/icons/Hamburger";
import UserIcon from "../components/icons/UserIcon";
import { apiGet, apiPost } from "./api"; // tus helpers

const API_BASE = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");

function getAuthToken() {
  return (
    localStorage.getItem("token") ||
    (() => {
      try {
        const u = JSON.parse(localStorage.getItem("user") || "null");
        return u?.token || null;
      } catch (e) {
        return null;
      }
    })()
  );
}

export default function TripItinerary() {
  // NOTE: read the param name that you defined in App.jsx (/:tripId)
  const params = useParams();
  const navigate = useNavigate();
  const tripIdRaw = params.tripId ?? params.id ?? params?.tripId; // tolerate either
  const tripId = Number(tripIdRaw);

  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState(null);
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [date, setDate] = useState("");
  const [startHour, setStartHour] = useState("");
  const [endHour, setEndHour] = useState("");
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!Number.isFinite(tripId) || tripId <= 0) {
        setError("ID de viaje inválido en la URL.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        // obtener trip (incluye places según tu controller)
        const tripRes = await apiGet(`/trips/${tripId}`);
        // obtener locations (lista para el dropdown)
        const locs = await apiGet("/locations");

        if (!mounted) return;
        setTrip(tripRes);
        setLocations(Array.isArray(locs) ? locs : []);
        setDate(tripRes?.start_date ? tripRes.start_date.split("T")[0] : "");
      } catch (err) {
        console.error("TripItinerary load error:", err);
        // intenta mostrar info útil si el helper apiGet devuelve un objeto con status
        if (err?.status === 401) setError("No autenticado. Por favor inicie sesión.");
        else if (err?.status === 403) setError("No autorizado para ver ese viaje.");
        else if (err?.status === 404) setError("Viaje no encontrado (compruebe ownership o id).");
        else setError("No se pudo cargar el viaje o las localidades.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [tripId]);

  async function handleAddPlace(e) {
    e?.preventDefault();
    if (!selectedLocation) {
      alert("Seleccione una ubicación.");
      return;
    }
    if (!date) {
      alert("Seleccione una fecha.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const payload = {
        places: [
          {
            fk_location: Number(selectedLocation),
            date,
            start_hour: startHour || null,
            end_hour: endHour || null,
            notes: notes || null,
          },
        ],
      };
      const res = await apiPost(`/trips/${tripId}/places`, payload);
      const created = res?.places ?? [];
      setTrip((t) => ({
        ...t,
        places: Array.isArray(t?.places) ? [...t.places, ...created] : created,
      }));
      setSelectedLocation("");
      setStartHour("");
      setEndHour("");
      setNotes("");
    } catch (err) {
      console.error("Add place error:", err);
      setError("No se pudo añadir el lugar. Intente nuevamente.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDeletePlace(placeId) {
    const ok = window.confirm("¿Eliminar este punto del itinerario?");
    if (!ok) return;
    try {
      const token = getAuthToken();
      const url = `${API_BASE || ""}/trips/${tripId}/places/${placeId}`;
      const opts = { method: "DELETE", headers: { "Content-Type": "application/json" } };
      if (token) opts.headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url, opts);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`${res.status} ${txt}`);
      }
      setTrip((t) => ({
        ...t,
        places: (t?.places || []).filter((p) => p.id !== placeId),
      }));
    } catch (err) {
      console.error("Delete place error:", err);
      setError("No se pudo eliminar el lugar.");
    }
  }

  if (loading) {
    return (
      <div className="trip-it-root">
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className="home-header">
          <button className="icon-btn icon-left" aria-label="menu" onClick={() => setMenuOpen(v => !v)}>
            <Hamburger />
          </button>
          <button className="icon-btn icon-right" aria-label="profile" onClick={() => navigate("/profile")}>
            <UserIcon />
          </button>
        </div>
        <main className="trip-it-main">
          <div> Cargando itinerario… </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="trip-it-root">
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className="home-header">
          <button className="icon-btn icon-left" aria-label="menu" onClick={() => setMenuOpen(v => !v)}>
            <Hamburger />
          </button>
          <button className="icon-btn icon-right" aria-label="profile" onClick={() => navigate("/profile")}>
            <UserIcon />
          </button>
        </div>
        <main className="trip-it-main">
          <div style={{ padding: 24 }}>
            <button className="back-link" onClick={() => navigate("/trips")}>← Volver a viajes</button>
            <div style={{ marginTop: 18, color: "#b00020" }}>{error}</div>
          </div>
        </main>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="trip-it-root">
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className="home-header">
          <button className="icon-btn icon-left" aria-label="menu" onClick={() => setMenuOpen(v => !v)}>
            <Hamburger />
          </button>
          <button className="icon-btn icon-right" aria-label="profile" onClick={() => navigate("/profile")}>
            <UserIcon />
          </button>
        </div>
        <main className="trip-it-main">
          <div className="trip-it-empty">No se encontró el viaje.</div>
        </main>
      </div>
    );
  }

  return (
    <div className="trip-it-root">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="home-header">
        <button className="icon-btn icon-left" aria-label="menu" onClick={() => setMenuOpen(v => !v)}>
          <Hamburger />
        </button>
        <button className="icon-btn icon-right" aria-label="profile" onClick={() => navigate("/profile")}>
          <UserIcon />
        </button>
      </div>

      <main className="trip-it-main">
        <aside className="trip-it-left">
          <button className="back-link" onClick={() => navigate("/trips")}>← Volver a viajes</button>

          <h2 className="trip-it-title">{trip.destination}</h2>
          <div className="trip-it-dates">
            {trip.start_date ? new Date(trip.start_date).toLocaleDateString() : "-"} — {trip.end_date ? new Date(trip.end_date).toLocaleDateString() : "-"}
          </div>

          <h3 style={{ marginTop: 18 }}>Agregar punto al itinerario</h3>
          <form onSubmit={handleAddPlace} className="trip-it-form">
            <label>Ubicación</label>
            <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)}>
              <option value="">— seleccionar —</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.titulo} ({l.fk_interest})
                </option>
              ))}
            </select>

            <label style={{ marginTop: 8 }}>Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

            <label style={{ marginTop: 8 }}>Hora inicio</label>
            <input type="time" value={startHour} onChange={(e) => setStartHour(e.target.value)} />

            <label style={{ marginTop: 8 }}>Hora fin (opcional)</label>
            <input type="time" value={endHour} onChange={(e) => setEndHour(e.target.value)} />

            <label style={{ marginTop: 8 }}>Notas (opcional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />

            <div style={{ marginTop: 10 }}>
              <button type="submit" disabled={adding} className="btn-primary">
                {adding ? "Agregando…" : "Agregar al itinerario"}
              </button>
            </div>
            {error && <div className="error">{error}</div>}
          </form>

          <h3 style={{ marginTop: 18 }}>Itinerario actual</h3>
          <div className="places-list">
            {(trip.places || []).length === 0 ? (
              <div className="muted">Aún no hay puntos en el itinerario.</div>
            ) : (
              (trip.places || []).map((p) => (
                <div key={p.id} className="place-item">
                  <div className="place-main">
                    <div className="place-title">{p.location?.titulo ?? `Lugar #${p.fk_location}`}</div>
                    <div className="place-meta">{p.date ? new Date(p.date).toLocaleDateString() : ""} {p.start_hour ? ` • ${p.start_hour}` : ""}</div>
                    {p.notes && <div className="place-notes">{p.notes}</div>}
                  </div>
                  <div className="place-actions">
                    <button onClick={() => handleDeletePlace(p.id)} className="btn-link small">Eliminar</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        <section className="trip-it-right">
          <div className="map-panel">
            <MapSvg width={880} height={600} />
          </div>
        </section>
      </main>
    </div>
  );
}
