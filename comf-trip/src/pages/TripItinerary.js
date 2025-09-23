// src/pages/TripItinerary.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Map, { Marker, NavigationControl, Popup } from "react-map-gl/mapbox";
import "../styles/tripItinerary.css";
import Header from "../components/Header";
import "../styles/header.css";
import { apiDelete, apiGet } from "./api";

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || "";

export default function TripItinerary() {
  const params = useParams();
  const navigate = useNavigate();
  const tripIdRaw = params.tripId ?? params.id ?? params?.tripId;
  const tripId = Number(tripIdRaw);
  const [menuOpen, setMenuOpen] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const today = new Date();

  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState(null);

  // map viewport (centered on first place or default)
  const [viewState, setViewState] = useState({
    latitude: -34.6037,
    longitude: -58.3816,
    zoom: 11
  });
  const [selectedLocationOnMap, setSelectedLocationOnMap] = useState(null);

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
        const tripRes = await apiGet(`/trips/${tripId}`);

        if (!mounted) return;

        // Add test images for first place if none (non-blocking)
        if (tripRes.places && tripRes.places.length > 0) {
          if (!tripRes.places[0].images || !tripRes.places[0].images.length) {
            tripRes.places[0].images = [
              "https://i.pinimg.com/originals/d8/5d/9a/d85d9a3c01e81a917af38532b6b7523c.jpg",
            ];
          }
        }

        setTrip(tripRes);

        // set map center to first place that has coordinates
        const firstWithCoords = (tripRes.places || []).find((p) => p.location && p.location.latitude && p.location.longitude);
        if (firstWithCoords) {
          setViewState({
            latitude: Number(firstWithCoords.location.latitude),
            longitude: Number(firstWithCoords.location.longitude),
            zoom: 12
          });
        }
      } catch (err) {
        console.error("TripItinerary load error:", err);
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
          height: "80vh"
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

  // marker list derived from trip.places
  const markers = (trip.places || [])
    .map((p) => {
      const loc = p.location || {};
      const lat = loc.latitude !== undefined ? Number(loc.latitude) : (loc.latitud !== undefined ? Number(loc.latitud) : null);
      const lng = loc.longitude !== undefined ? Number(loc.longitude) : (loc.longitud !== undefined ? Number(loc.longitud) : null);
      return {
        place: p,
        latitude: lat,
        longitude: lng,
        title: loc.titulo
      };
    })
    .filter(m => m.latitude != null && m.longitude != null);

  return (
    <div className="trip-it-root">
      <Header/>

      <main className="trip-it-main"  style={{padding: "70px 20px 0 20px"}}>

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
                <div key={p.id} className="place-item"
                     style={{borderColor: ((selectedPlace?.id === p.id) ? "#ff3951":""), backgroundColor: (new Date(p.date)<today) ? "#fafafa": ""}}>
                <div style={{width: "100%"}} onClick={() => {
                  if (selectedPlace?.id === p.id) {
                    setSelectedPlace(null);
                    setSelectedLocationOnMap(null);
                  } else {
                    setSelectedPlace(p);
                    setSelectedLocationOnMap({
                      latitude: p.location?.latitude ?? p.location?.latitud,
                      longitude: p.location?.longitude ?? p.location?.longitud,
                      titulo: p.location?.titulo
                    });
                    if (p.location && (p.location.latitude || p.location.latitud)) {
                      const lat = Number(p.location.latitude ?? p.location.latitud);
                      const lng = Number(p.location.longitude ?? p.location.longitud);
                      setViewState((v) => ({ ...v, latitude: lat, longitude: lng, zoom: 13 }));
                    }
                  }
                  setMenuOpen(!menuOpen);}}>
                  <div className="place-main">
                    <div className="place-title">{p.location?.titulo ?? `Lugar #${p.fk_location}`}</div>
                    <div className="place-meta">{p.date ? new Date(p.date).toLocaleDateString() : ""} {p.start_hour} {p.end_hour ? ` - ${p.end_hour}` : ""}</div>
                    {p.notes && <div className="place-notes">{p.notes}</div>}
                  </div></div>
                  <div className="trip-menu-wrapper">
                    <button
                        className="trip-menu-btn"
                        onClick={() =>
                        {setMenuOpen(menuOpen === p.id ? null : p.id)
                            setSelectedPlace(p);
                        }}
                    >⋮
                    </button>

                    {menuOpen === p.id && (
                        <div className="trip-menu">
                          <button className="trip-menu-btn"
                                  onClick={() => {
                                    navigate(`/edit-place/${tripId}?placeIndex=${trip.places.indexOf(p)}`);

                                    setMenuOpen(null);
                                  }}
                          >✎
                          </button>
                          <button className="trip-menu-btn"
                                  onClick={() => {handleDeletePlace(p.id);
                                                        setMenuOpen(null);}}
                          >🗑
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
            <div className="map-wrapper" style={{height: "100%"}}>
              <Map
                {...viewState}
                onMove={(evt) => setViewState(evt.viewState)}
                style={{ width: "100%", height: "100%" }}
                mapStyle="mapbox://styles/mapbox/streets-v11"
                mapboxAccessToken={MAPBOX_TOKEN}
              >
                <div style={{ position: "absolute", right: 10, top: 10, zIndex: 1 }}>
                  <NavigationControl showCompass showZoom />
                </div>

                {markers.map((m) => (
                  <Marker
                    key={`m-${m.place.id}`}
                    longitude={Number(m.longitude)}
                    latitude={Number(m.latitude)}
                    anchor="bottom"
                    onClick={(e) => {
                      e.originalEvent && e.originalEvent.stopPropagation();
                      setSelectedPlace(m.place);
                      setSelectedLocationOnMap({ latitude: m.latitude, longitude: m.longitude, titulo: m.title });
                      setViewState((v) => ({ ...v, latitude: Number(m.latitude), longitude: Number(m.longitude), zoom: 14 }));
                    }}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      style={{ transform: "translate(-12px,-24px)", cursor: "pointer" }}
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ff3951" />
                      <circle cx="12" cy="9" r="2.5" fill="#fff" />
                    </svg>
                  </Marker>
                ))}

                {selectedLocationOnMap && (
                  <Popup
                    longitude={Number(selectedLocationOnMap.longitude)}
                    latitude={Number(selectedLocationOnMap.latitude)}
                    anchor="top"
                    onClose={() => setSelectedLocationOnMap(null)}
                    closeOnClick={false}
                  >
                    <div style={{ maxWidth: 260 }}>
                      <strong style={{ marginBottom: 6 }}>{selectedLocationOnMap.titulo}</strong>
                    </div>
                  </Popup>
                )}
              </Map>
            </div>
          ) : (
            <div className="place-detail">
              <h3 style={{fontSize:"34px",marginTop:"5px",  marginBottom:"5px"}}>{selectedPlace.location?.titulo ?? `Lugar #${selectedPlace.fk_location}`}</h3>
              <p style= {{fontSize:"16px",marginTop:"5px",  marginBottom:"5px"}}><strong>Fecha:</strong> {selectedPlace.date ? new Date(selectedPlace.date).toLocaleDateString() : "-"}</p>
              <p style= {{fontSize:"16px",marginTop:"5px",  marginBottom:"5px"}}><strong>Hora:</strong> {selectedPlace.start_hour} {selectedPlace.end_hour ? ` - ${selectedPlace.end_hour}` : ""}</p>
              <p style= {{fontSize:"16px",marginTop:"5px",  marginBottom:"5px"}}><strong>Notas:</strong> {selectedPlace.notes ? `${selectedPlace.notes}` : '-'}</p>

              {selectedPlace.images && selectedPlace.images.length > 0 && (
                  <div style={{marginTop:"10px"}}><strong style={{fontSize:"18px",marginTop:"30px", marginBottom:"5px"}}>Imagenes</strong>
                  <div className="place-images">
                    {selectedPlace.images.map((imgUrl, i) => (
                        <img key={i} src={imgUrl} alt={`Lugar ${i + 1}`} className="place-image"/>
                    ))}
                  </div></div>
                  )}
              <div style={{marginTop:"20px"}}><strong style={{fontSize:"18px",marginTop:"30px", marginBottom:"5px"}}>Mapa</strong></div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
