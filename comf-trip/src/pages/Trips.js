import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/trips.css";
import Header from "../components/Header";
import "../styles/header.css";
import { apiGet, apiDelete, apiPost } from "./api";
import { MapPin, Calendar,  ArrowDownWideNarrow, ArrowUpWideNarrow } from "lucide-react";

export default function Trips() {
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  const navigate = useNavigate();

  // estados para compartir viajes
  const [showShareModal, setShowShareModal] = useState(false);
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [tripToShare, setTripToShare] = useState(null);
  const [sharing, setSharing] = useState(false);

    const [typeFilter, setTypeFilter] = useState("");
    const [countryFilter, setCountryFilter] = useState("");
    const [provinceFilter, setProvinceFilter] = useState("");
    const [creatorFilter, setCreatorFilter] = useState("");

    const [sortBy, setSortBy] = useState("trip_date"); // 'trip_date' o 'created_at'
    const [sortOrder, setSortOrder] = useState("desc"); // 'asc' o 'desc'


// opciones dinámicas
    const [availableCountries, setAvailableCountries] = useState([]);
    const [availableProvinces, setAvailableProvinces] = useState([]);

    // obtener ID del usuario actual desde token
  const getCurrentUserId = () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload && (payload.id || payload.userId || payload.sub || payload.user_id)
        ? Number(payload.id || payload.userId || payload.sub || payload.user_id)
        : null;
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
          const sorted = [...res].sort((a, b) => {
            const aNow = isCurrentTrip(a);
            const bNow = isCurrentTrip(b);
            if (aNow && !bNow) return -1;
            if (!aNow && bNow) return 1;
            return normalizeDate(b.start_date) - normalizeDate(a.start_date);
          });
          setTrips(sorted);
          setSelectedTrip(sorted.length ? sorted[0] : null);
        } else {
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

    useEffect(() => {
        const countries = [...new Set(trips.map(t => t.destination.split(",")[1]).filter(Boolean))];
        setAvailableCountries(countries);
    }, [trips]);

    useEffect(() => {
        setProvinceFilter("");
        if (countryFilter) {
            const provinces = [...new Set(
                trips.filter(t => t.destination.split(",")[1] === countryFilter)
                    .map(t => t.destination.split(",")[0])
                    .filter(Boolean)
            )];
            setAvailableProvinces(provinces);
        } else {
            setAvailableProvinces([]);
        }
    }, [countryFilter, trips]);


    const filteredTrips = trips.filter(t => {
        const start = normalizeDate(t.start_date);
        const end = normalizeDate(t.end_date);
        const today = new Date();

        // Tipo de viaje
        if (typeFilter === "current" && !(today >= start && today <= end)) return false;
        if (typeFilter === "upcoming" && !(today < start)) return false;
        if (typeFilter === "past" && !(today > end)) return false;

        // País / provincia
        if (countryFilter && t.destination.split(",")[1] !== countryFilter) return false;
        if (provinceFilter && t.destination.split(",")[0] !== provinceFilter) return false;

        // Creador
        const isMine = currentUserId && Number(t.user_id) === Number(currentUserId);
        if (creatorFilter === "me" && !isMine) return false;
        else if (creatorFilter === "others" && isMine) return false;

        return true;
    });

    const sortedTrips = [...filteredTrips].sort((a, b) => {
        let aValue, bValue;

        if (sortBy === "trip_date") {
            aValue = normalizeDate(a.start_date);
            bValue = normalizeDate(b.start_date);
        } else {
            aValue = normalizeDate(a.created_at);
            bValue = normalizeDate(b.created_at);
        }

        return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
    });



    // funciones para compartir viajes
  async function loadFriends() {
    try {
      const res = await apiGet('/friends');
      const friendsArr = Array.isArray(res) ? res : (res && res.rows ? res.rows : []);
      setFriends(friendsArr);
    } catch (err) {
      console.error('Error cargando amigos:', err);
      alert('No se pudieron cargar tus amigos.');
    }
  }

  function openShareModal(trip) {
    setTripToShare(trip);
    setSelectedFriend(null);
    setShowShareModal(true);
    loadFriends();
  }

  async function submitShare() {
    if (!tripToShare || !selectedFriend) return alert('Selecciona un amigo para compartir');
    setSharing(true);
    try {
      await apiPost(`/trips/${tripToShare.id}/share`, {
        mode: 'viewer',
        public: false,
        shared_with_user_id: selectedFriend.id,
      });
      alert(`Viaje compartido con ${selectedFriend.name || selectedFriend.email}`);
      setShowShareModal(false);
      setTripToShare(null);
    } catch (err) {
      console.error('Error compartiendo viaje:', err);
      alert('No se pudo compartir el viaje.');
    } finally {
      setSharing(false);
    }
  }

  if (loading) {
    return (
      <div className="trips-root">
        <Header />

            <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh"
            }}><div className="muted" style={{fontSize:"25px", alignSelf:"center"}}>Cargando viajes…</div></div>
          
      </div>
    );
  }

  return (
    <div className="trips-root">
      <Header />

      <main className="trips-main">

          {trips.length === 0 ? (
            <div className="trips-message" style={{border:"none"}}>
              No tienes ningún viaje activo actualmente
              <br />
              ¡Planea tu siguiente viaje!
            </div>
          ) : (
            <>
              <h3 className="trips-list-title">Tus viajes</h3>
                <div className="trips-filters">
                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center", flex: 1 }}>
                        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                            <option value="">Todos los viajes</option>
                            <option value="current">Viajes actuales</option>
                            <option value="upcoming">Próximos viajes</option>
                            <option value="past">Viajes anteriores</option>
                        </select>

                        <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}>
                            <option value="">Todos los países</option>
                            {availableCountries.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>

                        <select
                            value={provinceFilter}
                            onChange={(e) => setProvinceFilter(e.target.value)}
                            disabled={!countryFilter}
                        >
                            <option value="">Todas las provincias</option>
                            {availableProvinces.map((p) => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>

                        <select value={creatorFilter} onChange={(e) => setCreatorFilter(e.target.value)}>
                            <option value="">Todos</option>
                            <option value="me">Creados por mí</option>
                            <option value="others">Creados por otros</option>
                        </select>
                    </div>

                    {/* NUEVOS CONTROLES A LA DERECHA */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginLeft: "auto" }}>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #ddd" }}
                        >
                            <option value="trip_date">Ordenar por: Fecha de viaje</option>
                            <option value="created_at">Ordenar por: Fecha de creación</option>
                        </select>

                        <button
                            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                            style={{
                                border: "1px solid #ddd",
                                borderRadius: "8px",
                                background: "#fff",
                                padding: "8px 12px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                            title={sortOrder === "asc" ? "Ascendente" : "Descendente"}
                        >
                            {sortOrder === "asc" ? (
                                <ArrowUpWideNarrow size={22} color="#333" />
                            ) : (
                                <ArrowDownWideNarrow size={22} color="#333" />
                            )}
                        </button>

                    </div>
                </div>

                <div style={{background:"#ff3951", height:2, marginBottom:20, marginTop:20}}></div>


                <div className="trips-list" role="list">
                {sortedTrips.map((t) => {
                  const isOwner = currentUserId ? Number(t.user_id) === Number(currentUserId) : null;
                  return (
                    <div
                      key={t.id}
                      className={`trips-list-item ${selectedTrip && selectedTrip.id === t.id ? "active" : ""}`}
                      role="listitem"
                    >
                      <div
                        className="trip-item-main"
                        onClick={() => navigate(`/trip_itinerary/${t.id}`)}
                      >
                        <div className="trip-destination"><MapPin size={28} color="#ff3951" strokeWidth={2.5} style={{ marginRight: 12, marginBottom:-3 }} />
                            {t.destination ?? "Destino desconocido"}
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

                          <div className="trip-dates" style={{paddingBottom:10}}>
                              <Calendar size={18} color="#8a6b80" strokeWidth={2} style={{ marginRight: 8, marginBottom:-3 }} />
                              {fmtDate(t.start_date)} — {fmtDate(t.end_date)}
                          </div>

                          <div className="trip-created">Creado: {fmtDate(t.created_at)}</div>
                      </div>

                      <div className="trip-menu-wrapper">
                        <button
                          className="trip-menu-btn"
                          onClick={() => setMenuOpen(menuOpen === t.id ? null : t.id)}
                        >
                          ⋮
                        </button>

                        {menuOpen === t.id && (
                          <div className="trip-menu">
                            <button className="trip-menu-btn" onClick={() => openShareModal(t)}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path d="M4 12V19C4 19.55 4.45 20 5 20H19C19.55 20 20 19.55 20 19V12"
                                      stroke="#1E1E1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M12 4V15M12 4L8 8M12 4L16 8"
                                      stroke="#1E1E1E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>

                            <button className="trip-menu-btn"
                              onClick={() => {navigate(`/edit-trip/${t.id}`); setMenuOpen(null);}}>✎</button>

                            <button
                              className="trip-menu-btn"
                              onClick={async () => {
                                if (window.confirm(`¿Seguro que deseas eliminar el viaje a ${t.destination}?`)) {
                                  try {
                                    await apiDelete(`/trips/${t.id}`);
                                    setTrips((prev) => prev.filter((trip) => trip.id !== t.id));
                                    setMenuOpen(null);
                                  } catch (err) {
                                    console.error("Error eliminando viaje:", err);
                                    alert("No se pudo eliminar el viaje.");
                                  }
                                }
                              }}
                            >🗑</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}


        <div className="trips-cta">
          <button className="btn-newtrip" onClick={() => navigate("/add-trip")}>
            Nuevo Viaje &nbsp; &gt;
          </button>
        </div>

        {/* Modal de compartir */}
        {showShareModal && tripToShare && (
          <div className="modal-overlay" onClick={() => !sharing && setShowShareModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={() => !sharing && setShowShareModal(false)}>×</button>
              <h3>Compartir "{tripToShare.destination}"</h3>
              <p className="hint">Selecciona un amigo para compartir este viaje:</p>

              {friends.length === 0 ? (
                <div className="muted">No tienes amigos con los que compartir.</div>
              ) : (
                <div className="list">
                  {friends.map(f => (
                    <label key={f.id} style={{ display: 'block', cursor: 'pointer', marginBottom: 8 }}>
                      <input
                        type="radio"
                        name="friend"
                        value={f.id}
                        checked={selectedFriend && selectedFriend.id === f.id}
                        onChange={() => setSelectedFriend(f)}
                        disabled={sharing}
                      /> {f.name || f.email || `Usuario ${f.id}`}
                    </label>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn ghost" onClick={() => !sharing && setShowShareModal(false)}>Cancelar</button>
                <button className="btn" onClick={submitShare} disabled={!selectedFriend || sharing}>
                  {sharing ? 'Compartiendo…' : 'Compartir'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
