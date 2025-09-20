// src/pages/TripItinerary.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MapSvg from "../components/MapSvg";
import "../styles/tripItinerary.css";
import Header from "../components/Header";
import "../styles/header.css";
import {apiDelete, apiGet} from "./api"; // tus helpers

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
  const [menuOpen, setMenuOpen] = useState(null); // id del menú abierto
  const [selectedPlace, setSelectedPlace] = useState(null);


  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState(null);
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

        if (!mounted) return;

        // ----> AGREGAR FOTOS DE PRUEBA A UN SOLO LUGAR
        if (tripRes.places && tripRes.places.length > 0) {
          // Elegimos el primer lugar para mostrar fotos de prueba

          tripRes.places[0].images = [
            "https://i.pinimg.com/originals/d8/5d/9a/d85d9a3c01e81a917af38532b6b7523c.jpg",
            "https://s3-sa-east-1.amazonaws.com/modernabuenosaires/img/obras/galeria/7_1406143152.jpg",
            "https://s3-sa-east-1.amazonaws.com/modernabuenosaires/img/obras/galeria/7_1406143152.jpg",
            "https://s3-sa-east-1.amazonaws.com/modernabuenosaires/img/obras/galeria/7_1406143152.jpg",
            "https://s3-sa-east-1.amazonaws.com/modernabuenosaires/img/obras/galeria/7_1406143152.jpg",
            "https://s3-sa-east-1.amazonaws.com/modernabuenosaires/img/obras/galeria/7_1406143152.jpg",
            "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/12/09/20/0c/obelisco-de-buenos-aires.jpg?w=1200&h=-1&s=1"
          ];
        }

        setTrip(tripRes);
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

  const fmtDate = (d) => {
    if (!d) return "-";
    try {
      const date = new Date(d);
      return date.toLocaleDateString();
    } catch (e) {
      return d;
    }
  };

  async function handleDeletePlace(placeId) {
    if (!window.confirm("¿Eliminar este punto del itinerario?")) return;

    try {
      await apiDelete(`/trips/${tripId}/places/${placeId}`);
      setTrip((t) => ({
        ...t,
        places: (t?.places || []).filter((p) => p.id !== placeId),
      }));
      setMenuOpen(null);
    } catch (err) {
      console.error("Delete place error:", err);
      setError("No se pudo eliminar el lugar.");
    }
  }

  if (loading) {
    return (
      <div className="trip-it-root">
        <Header/>
        <main className="trip-it-main" style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "80vh" // ocupa casi toda la pantalla
        }}>
          <div style={{fontSize:25}}> Cargando itinerario… </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="trip-it-root">
        <Header/>
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
        <Header/>
        </div>
    );
  }

  return (
    <div className="trip-it-root">
      <Header/>

      <main className="trip-it-main">

        <section className="trip-it-left">

          <button className="back-link" onClick={() => navigate("/trips")}>← Volver a viajes</button>
          <h2 className="trip-it-title">{trip.destination}</h2>
          <div className="trip-it-dates">
            {trip.start_date ? new Date(trip.start_date).toLocaleDateString() : "-"} — {trip.end_date ? new Date(trip.end_date).toLocaleDateString() : "-"}
          </div>
            {trip?.budget != null && (
                  <p className="trip-detail-row">
                    <strong>Presupuesto:</strong> ${trip.budget}
                  </p>
              )}
            {trip?.notes && (
                  <p className="trip-detail-row">
                    <strong>Notas:</strong> {trip.notes}
                  </p>
              )}
              <div className="trip-it-created">
                Creado: {fmtDate(trip.created_at)}
              </div>

          <h3 style={{ marginTop: 18 }}>Itinerario actual</h3>
          <div className="places-list">
            {(trip.places || []).length === 0 ? (
              <div className="muted">Aún no hay puntos en el itinerario.</div>
            ) : (
              (trip.places || []).map((p) => (
                <div key={p.id} className="place-item" style={{borderColor: ((selectedPlace?.id === p.id) ? "#ff3951":"transparent")}} onClick={() => {
                  if (selectedPlace?.id === p.id) {
                    setSelectedPlace(null); // clic en mismo lugar = cerrar info
                  } else {
                    setSelectedPlace(p);
                  }
                }}>
                  <div className="place-main">
                    <div className="place-title">{p.location?.titulo ?? `Lugar #${p.fk_location}`}</div>
                    <div className="place-meta">{p.date ? new Date(p.date).toLocaleDateString() : ""}
                      {p.start_hour} {p.end_hour ? ` - ${p.end_hour}` : ""}</div>
                    {p.notes && <div className="place-notes">{p.notes}</div>}
                  </div>
                  <div className="trip-menu-wrapper">
                    <button
                        className="trip-menu-btn"
                        onClick={() =>
                            setMenuOpen(menuOpen === p.id ? null : p.id)
                        }
                    >⋮
                    </button>

                    {menuOpen === p.id && (
                        <div className="trip-menu">
                          <button className="trip-menu-btn"
                                  onClick={() => {
                                    navigate(`/trips/editProgram/${p.id}`);
                                    setMenuOpen(null);
                                  }}
                          ><svg width="20" height="20" viewBox="0 0 41 37" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18.7915 6.16667H6.83317C5.92701 6.16667 5.05797 6.49152 4.41722 7.06975C3.77647 7.64799 3.4165 8.43225 3.4165 9.25V30.8333C3.4165 31.6511 3.77647 32.4353 4.41722 33.0136C5.05797 33.5918 5.92701 33.9167 6.83317 33.9167H30.7498C31.656 33.9167 32.525 33.5918 33.1658 33.0136C33.8065 32.4353 34.1665 31.6511 34.1665 30.8333V20.0417M31.604 3.85417C32.2836 3.24085 33.2054 2.8963 34.1665 2.8963C35.1276 2.8963 36.0494 3.24085 36.729 3.85417C37.4086 4.46748 37.7904 5.29931 37.7904 6.16667C37.7904 7.03402 37.4086 7.86585 36.729 8.47917L20.4998 23.125L13.6665 24.6667L15.3748 18.5L31.604 3.85417Z" stroke="#1E1E1E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                          </button>
                          <button className="trip-menu-btn"
                                  onClick={() => {handleDeletePlace(p.id);
                                                        setMenuOpen(null);}}
                          ><svg width="20" height="20" viewBox="0 0 45 43" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M5.625 10.75H9.375M9.375 10.75H39.375M9.375 10.75V35.8333C9.375 36.7837 9.77009 37.6951 10.4733 38.3671C11.1766 39.0391 12.1304 39.4167 13.125 39.4167H31.875C32.8696 39.4167 33.8234 39.0391 34.5266 38.3671C35.2299 37.6951 35.625 36.7837 35.625 35.8333V10.75M15 10.75V7.16667C15 6.21631 15.3951 5.30487 16.0984 4.63287C16.8016 3.96086 17.7554 3.58333 18.75 3.58333H26.25C27.2446 3.58333 28.1984 3.96086 28.9016 4.63287C29.6049 5.30487 30 6.21631 30 7.16667V10.75M18.75 19.7083V30.4583M26.25 19.7083V30.4583" stroke="#1E1E1E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>

                          </button>
                        </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <div style={{ marginTop: 10 }}>
            <button onClick={() => navigate(`/add_place/${tripId}`)} className="btn-primary">
              Agregar al itinerario
            </button>
          </div>
        </section>
        <section className="trip-it-right">
        {!selectedPlace ? (

          <div className="map-wrapper">
            <MapSvg width={999} height={800} />
          </div>

            ) : (

              <div className="place-detail">
                <h3 style={{fontSize:"50px",marginTop:"5px",  marginBottom:"5px"}}>{selectedPlace.location?.titulo ?? `Lugar #${selectedPlace.fk_location}`}</h3>
                <p style= {{fontSize:"20px",marginTop:"5px",  marginBottom:"5px"}}><strong>Fecha:</strong> {selectedPlace.date ? new Date(selectedPlace.date).toLocaleDateString() : "-"}</p>
                <p style= {{fontSize:"20px",marginTop:"5px",  marginBottom:"5px"}}><strong>Hora:</strong> {selectedPlace.start_hour} {selectedPlace.end_hour ? ` - ${selectedPlace.end_hour}` : ""}</p>
                <p style= {{fontSize:"20px",marginTop:"5px",  marginBottom:"5px"}}><strong>Notas:</strong> {selectedPlace.notes ? `${selectedPlace.notes}` : '-'}</p>
                {/* Agregá más info si querés */}

                {/* Imágenes */}
                {selectedPlace.images && selectedPlace.images.length > 0 && (
                    <div style={{marginTop:"10px"}}><strong style={{fontSize:"20px",marginTop:"30px", marginBottom:"5px"}}>Imagenes</strong>
                    <div className="place-images">
                      {selectedPlace.images.map((imgUrl, i) => (
                          <img key={i} src={imgUrl} alt={`Lugar ${i + 1}`} className="place-image"/>
                      ))}
                    </div></div>
                    )}
                <div style={{marginTop:"20px"}}><strong style={{fontSize:"20px",marginTop:"30px", marginBottom:"5px"}}>Mapa</strong></div>
              </div>

        )}</section>
      </main>
    </div>
  );
}
