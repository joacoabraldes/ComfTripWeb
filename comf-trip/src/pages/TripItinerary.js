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
  const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

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

    const normalizeDate=(d)=>{
        if(!d) return new Date();
        const date=d.split("T")[0].split("-");
        const yy = Number(date[0]);
        const mm =Number(date[1])-1;
        const dd = Number(date[2]);
        return new Date(yy, mm, dd);
    }

    const pastPlace=(d, et)=>{
        if(!d || !et) return false;
        if(normalizeDate(d).getTime()===today.getTime()){
            //const [sh, sm] = st.split(":").map(Number);
            const [eh, em] = et.split(":").map(Number);

            //const startMinutes = sh * 60 + sm;
            const endMinutes = eh * 60 + em;
            const t=new Date();
            const currentTime=(t.getHours())*60+(t.getMinutes());
            return endMinutes<currentTime;
        }
        return normalizeDate(d)<today;

    }

  if (loading) {
    return (
      <div className="trip-it-root">
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
          title: loc.titulo,
          images:loc.imagenes
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
            {fmtDate(trip.start_date)} — {fmtDate(trip.end_date)}
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
              (trip.places || []).map((p,i) => (
                <div key={p.id} className="place-item"
                     style={{borderColor: ((selectedPlace?.id === p.id) ? "#ff3951":""), backgroundColor: pastPlace(p.date, p.end_hour) ? "#fafafa": ""}}>
                <div style={{width: "100%"}} onClick={() => {
                  if (selectedPlace?.id === p.id) {
                    setSelectedPlace(null);
                    setSelectedLocationOnMap(null);
                      const lat = Number(p.location.latitude ?? p.location.latitud);
                      const lng = Number(p.location.longitude ?? p.location.longitud);
                      setViewState((v) => ({ ...v, latitude: lat, longitude: lng, zoom: 12 }));
                  } else {
                    setSelectedPlace(p);
                    if (p.location && (p.location.latitude || p.location.latitud)) {
                      const lat = Number(p.location.latitude ?? p.location.latitud);
                      const lng = Number(p.location.longitude ?? p.location.longitud);
                      setViewState((v) => ({ ...v, latitude: lat, longitude: lng, zoom: 16 }));
                    }
                  }
                  setMenuOpen(!menuOpen);}}>
                  <div className="place-main">
                    <div className="place-title">{p.location?.titulo ?? `Lugar #${p.fk_location}`}</div>
                    <div className="place-meta">{fmtDate(p.date)} {fmtHour(p.start_hour)} {` - ${fmtHour(p.end_hour)}`}</div>
                  </div></div>
                  <div className="trip-menu-wrapper">
                    <button
                        className="trip-menu-btn"
                        onClick={() =>
                        {setMenuOpen(menuOpen === p.id ? null : p.id)
                            setSelectedPlace(p);
                            if (p.location && (p.location.latitude || p.location.latitud)) {
                                const lat = Number(p.location.latitude ?? p.location.latitud);
                                const lng = Number(p.location.longitude ?? p.location.longitud);
                                setViewState((v) => ({ ...v, latitude: lat, longitude: lng, zoom: 16 }));
                            }
                        }}
                    >⋮
                    </button>

                    {menuOpen === p.id && (
                        <div className="trip-menu">
                          <button className="trip-menu-btn"
                                  onClick={() => {
                                    navigate(`/edit-place/${trip.id}?placeIndex=${i}`);
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
                style={{ width: "100%", height: "100%", borderRadius: "10px" }}
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
                    anchor="bottom">
                      <div
                          onMouseEnter={() =>
                          setSelectedLocationOnMap({
                              latitude: m.latitude,
                              longitude: m.longitude,
                              titulo: m.title,
                              date: m.place.date,
                              startHour: m.place.start_hour,
                              endHour: m.place.end_hour,
                              image: m.images[0]
                          })
                      }
                          onMouseLeave={() => setSelectedLocationOnMap(null)}
                          onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPlace(m.place);
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
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ff3951" />
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
              </Map>
            </div>
          ) : (
            <div className="place-detail">
                <div className="place-it-row">
                    <img
                        src={selectedPlace.location?.imagenes[0]}
                        className="place-image"
                        alt="Lugar actual"
                    />
                    <div className="place-it-info">
                        <h3 style={{fontSize:"34px",marginTop:"5px",  marginBottom:"5px"}}>{selectedPlace.location?.titulo ?? `Lugar #${selectedPlace.fk_location}`}</h3>
                    <p style= {{fontSize:"16px",marginTop:"5px",  marginBottom:"5px"}}><strong>Fecha:</strong> {fmtDate(selectedPlace.date)}</p>
                        <p style= {{fontSize:"16px",marginTop:"5px",  marginBottom:"5px"}}><strong>Hora:</strong>
                            {fmtHour(selectedPlace.start_hour)} - {fmtHour(selectedPlace.end_hour)} </p></div></div>
                        <p style= {{fontSize:"16px",marginTop:"5px",  marginBottom:"5px"}}><strong>Notas:
                        </strong> {selectedPlace.notes ? `${selectedPlace.notes}` : '-'}</p>
                <div style={{ flex: 1, marginTop: 20 }}>
                    <Map
                        {...viewState}
                        onMove={(evt) => setViewState(evt.viewState)}
                        style={{ width: "100%", height: "100%", borderRadius: "10px" }}
                        mapStyle="mapbox://styles/mapbox/streets-v11"
                        mapboxAccessToken={MAPBOX_TOKEN}
                    >
                        <NavigationControl position="top-right" />
                        {markers.map((m) => (
                            <Marker
                                key={`m-${m.place.id}`}
                                longitude={Number(m.longitude)}
                                latitude={Number(m.latitude)}
                                anchor="bottom">
                                <div
                                    onMouseEnter={() =>
                                        setSelectedLocationOnMap({
                                            latitude: m.latitude,
                                            longitude: m.longitude,
                                            titulo: m.title,
                                            date: m.place.date,
                                            startHour: m.place.start_hour,
                                            endHour: m.place.end_hour,
                                            image: m.images[0]
                                        })
                                    }
                                    onMouseLeave={() => setSelectedLocationOnMap(null)}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedPlace(m.place);
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
                                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ff3951" />
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
                    </Map>
                </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}