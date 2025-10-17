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
        const firstWithCoords = (tripRes.places || []).find((p) => {
          const loc = p.location || {};
          return (loc.latitude !== undefined || loc.latitud !== undefined) && (loc.longitude !== undefined || loc.longitud !== undefined);
        });
        if (firstWithCoords) {
          const loc = firstWithCoords.location || {};
          const lat = Number(loc.latitude ?? loc.latitud);
          const lng = Number(loc.longitude ?? loc.longitud);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            setViewState({
              latitude: lat,
              longitude: lng,
              zoom: 12
            });
          }
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
      // if d is already a Date object, format it
      if (d instanceof Date) {
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yy = d.getFullYear();
        return `${dd}/${mm}/${yy}`;
      }
      const parts = String(d).split("T")[0].split("-");
      if (parts.length !== 3) return d;
      const yy = parts[0];
      const mm = parts[1];
      const dd = parts[2];
      return `${dd}/${mm}/${yy}`;
  };

  const fmtHour = (t) => {
      if(!t) return "-";
      const time = String(t).split(":");
      const hour = time[0] ?? "00";
      const min = time[1] ?? "00";
      return `${hour.padStart(2,"0")}:${min.padStart(2,"0")}`
  }

  async function handleDeletePlace(placeId) {
    if (!window.confirm("¿Eliminar este punto del itinerario?")) return;

    try {
      await apiDelete(`/trips/${tripId}/places/${placeId}`);
      setTrip((t) => (t ? {
        ...t,
        places: (t.places || []).filter((p) => p.id !== placeId),
      } : t));
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
          const [eh, em] = (et || "00:00").split(":").map(Number);
          const endMinutes = (Number.isFinite(eh) ? eh : 0) * 60 + (Number.isFinite(em) ? em : 0);
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

  // ---------- helpers to group places by date and sort by start_hour ----------
  const groupPlacesByDate = (places) => {
    const groups = {};
    (places || []).forEach((p) => {
      // use p.date (ISO) or fallback 'no-date'
      const dateKey = p?.date ? String(p.date).split("T")[0] : "no-date";
      groups[dateKey] = groups[dateKey] || [];
      groups[dateKey].push(p);
    });
    // sort keys chronologically (put 'no-date' at the end)
    const keys = Object.keys(groups).sort((a,b) => {
      if (a === "no-date") return 1;
      if (b === "no-date") return -1;
      return new Date(a) - new Date(b);
    });
    // sort each group's places by start_hour (if available)
    keys.forEach((k) => {
      groups[k].sort((x,y) => {
        const sx = (x.start_hour || "00:00").split(":").map(Number);
        const sy = (y.start_hour || "00:00").split(":").map(Number);
        const mx = (Number.isFinite(sx[0]) ? sx[0] : 0) * 60 + (Number.isFinite(sx[1]) ? sx[1] : 0);
        const my = (Number.isFinite(sy[0]) ? sy[0] : 0) * 60 + (Number.isFinite(sy[1]) ? sy[1] : 0);
        return mx - my;
      });
    });
    return { groups, keys };
  };

  const { groups: groupedPlaces, keys: groupKeys } = groupPlacesByDate(trip.places || []);

  // ---------- markers for map (defensive coordinate parsing) ----------
  const markers = (trip.places || [])
    .map((p) => {
      const loc = p.location || {};
      const latRaw = loc.latitude !== undefined ? loc.latitude : (loc.latitud !== undefined ? loc.latitud : null);
      const lngRaw = loc.longitude !== undefined ? loc.longitude : (loc.longitud !== undefined ? loc.longitud : null);
      const lat = latRaw !== null ? Number(latRaw) : null;
      const lng = lngRaw !== null ? Number(lngRaw) : null;
      return {
          place: p,
          latitude: lat,
          longitude: lng,
          title: loc.titulo ?? p.location?.titulo ?? `Lugar #${p.fk_location}`,
          images: loc.imagenes ?? loc.images ?? p.images ?? []
      };
    })
    .filter(m => Number.isFinite(m.latitude) && Number.isFinite(m.longitude));

  // ---------- utility to extract possible website from place/location ----------
  const getWebsiteFor = (p) => {
    if (!p) return null;
    // prefer explicit fields on place, then location
    const candidates = [
      p.website,
      p.link,
      p.url,
      p.location?.website,
      p.location?.url,
      p.location?.website_url,
    ];
    return candidates.find(c => typeof c === "string" && c.trim().length > 0) ?? null;
  };

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

          <h3 style={{ marginTop: 18 }}>Itinerario por día</h3>

          <div className="places-list">
            {groupKeys.length === 0 ? (
              <div className="muted">Aún no hay puntos en el itinerario.</div>
            ) : (
              groupKeys.map((dateKey) => (
                <div key={dateKey} style={{ marginBottom: 18 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 16 }}>
                    {dateKey === "no-date" ? "Fecha sin especificar" : fmtDate(dateKey)}
                  </div>
                  <div>
                    {(groupedPlaces[dateKey] || []).map((p, i) => {
                      const loc = p.location || {};
                      const lat = Number(loc.latitude ?? loc.latitud ?? null);
                      const lng = Number(loc.longitude ?? loc.longitud ?? null);
                      const website = getWebsiteFor(p) || getWebsiteFor(loc);
                      const isPast = pastPlace(p.date, p.end_hour);
                      return (
                        <div
                          key={p.id ?? `${dateKey}-${i}`}
                          className="place-item"
                          style={{
                            borderColor: (selectedPlace?.id === p.id) ? "#ff3951" : "",
                            backgroundColor: isPast ? "#fafafa" : "",
                            marginBottom: 8,
                            padding: 10,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            cursor: "pointer"
                          }}
                        >
                          <div style={{ flex: 1 }} onClick={() => {
                            // toggle selection
                            if (selectedPlace?.id === p.id) {
                              setSelectedPlace(null);
                              setSelectedLocationOnMap(null);
                              if (Number.isFinite(lat) && Number.isFinite(lng)) {
                                setViewState((v) => ({ ...v, latitude: lat, longitude: lng, zoom: 12 }));
                              }
                            } else {
                              setSelectedPlace(p);
                              if (Number.isFinite(lat) && Number.isFinite(lng)) {
                                setViewState((v) => ({ ...v, latitude: lat, longitude: lng, zoom: 16 }));
                              }
                            }
                            setMenuOpen(!menuOpen);
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div style={{ minWidth: 84 }}>
                                <div style={{ fontSize: 14, color: "#222", fontWeight: 700 }}>
                                  { (p.start_hour ? fmtHour(p.start_hour) : "—") } { p.end_hour ? `— ${fmtHour(p.end_hour)}` : "" }
                                </div>
                                <div style={{ fontSize: 12, color: "#666" }}>
                                  { (p.location?.titulo) ?? `Lugar #${p.fk_location}` }
                                </div>
                              </div>

                              <div>
                                <div style={{ fontSize: 15, fontWeight: 600 }}>{p.title ?? p.location?.titulo ?? p.location?.titulo ?? `Actividad`}</div>
                                {p.notes && <div style={{ fontSize: 13, color: "#444" }}>{p.notes}</div>}
                                {website && (
                                  <div style={{ marginTop: 6 }}>
                                    <a href={website.startsWith("http") ? website : `https://${website}`} target="_blank" rel="noreferrer" style={{ color: "#1978c8", fontSize: 13 }}>
                                      Ver sitio
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div className="trip-menu-wrapper" style={{ display: "flex", alignItems: "center" }}>
                              <button
                                className="trip-menu-btn"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setMenuOpen(menuOpen === p.id ? null : p.id);
                                  setSelectedPlace(p);
                                  if (Number.isFinite(lat) && Number.isFinite(lng)) {
                                    setViewState((v) => ({ ...v, latitude: lat, longitude: lng, zoom: 16 }));
                                  }
                                }}
                              >
                                ⋮
                              </button>

                              {menuOpen === p.id && (
                                <div className="trip-menu" style={{ position: "absolute", zIndex: 20 }}>
                                  <button className="trip-menu-btn"
                                          onClick={() => {
                                            navigate(`/edit-place/${trip.id}?placeIndex=${(trip.places||[]).findIndex(pp => pp.id === p.id)}`);
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
                        </div>
                      );
                    })}
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
                onMove={(evt) => {
                  if (evt?.viewState) setViewState(evt.viewState);
                }}
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
                              image: m.images && m.images.length ? m.images[0] : null
                            })
                          }
                          onMouseLeave={() => setSelectedLocationOnMap(null)}
                          onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPlace(m.place);
                              if (Number.isFinite(Number(m.latitude)) && Number.isFinite(Number(m.longitude))) {
                                setViewState((v) => ({ ...v, latitude: Number(m.latitude), longitude: Number(m.longitude), zoom: 16 }));
                              }
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

                  {selectedLocationOnMap && Number.isFinite(Number(selectedLocationOnMap.latitude)) && Number.isFinite(Number(selectedLocationOnMap.longitude)) && (
                      <Popup
                          longitude={Number(selectedLocationOnMap.longitude)}
                          latitude={Number(selectedLocationOnMap.latitude)}
                          anchor="bottom"
                          closeButton={false}
                          offset={[-12, -53]}
                      >
                          <div className="place-popUp">
                              {selectedLocationOnMap.image ? (
                                <img
                                    src={selectedLocationOnMap.image}
                                    className="img-popUp"
                                    alt="Lugar actual"
                                />
                              ) : null}
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
                        src={selectedPlace.location?.imagenes ? selectedPlace.location?.imagenes[0] : (selectedPlace.location?.images ? selectedPlace.location?.images[0] : null)}
                        className="place-image"
                        alt="Lugar actual"
                    />
                    <div className="place-it-info">
                        <h3 style={{fontSize:"34px",marginTop:"5px",  marginBottom:"5px"}}>{selectedPlace.location?.titulo ?? `Lugar #${selectedPlace.fk_location}`}</h3>
                    <p style= {{fontSize:"16px",marginTop:"5px",  marginBottom:"5px"}}><strong>Fecha:</strong> {fmtDate(selectedPlace.date)}</p>
                        <p style= {{fontSize:"16px",marginTop:"5px",  marginBottom:"5px"}}><strong>Hora:</strong>
                            {fmtHour(selectedPlace.start_hour)} - {fmtHour(selectedPlace.end_hour)} </p>
                        {getWebsiteFor(selectedPlace) && (
                          <p style= {{fontSize:"16px",marginTop:"5px",  marginBottom:"5px"}}>
                            <strong>Sitio:</strong> <a href={getWebsiteFor(selectedPlace).startsWith("http") ? getWebsiteFor(selectedPlace) : `https://${getWebsiteFor(selectedPlace)}`} target="_blank" rel="noreferrer">{getWebsiteFor(selectedPlace)}</a>
                          </p>
                        )}
                    </div></div>
                        <p style= {{fontSize:"16px",marginTop:"5px",  marginBottom:"5px"}}><strong>Notas:
                        </strong> {selectedPlace.notes ? `${selectedPlace.notes}` : '-'}</p>
                <div style={{ flex: 1, marginTop: 20 }}>
                    <Map
                        {...viewState}
                        onMove={(evt) => { if (evt?.viewState) setViewState(evt.viewState); }}
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
                                            image: m.images && m.images.length ? m.images[0] : null
                                        })
                                    }
                                    onMouseLeave={() => setSelectedLocationOnMap(null)}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedPlace(m.place);
                                        if (Number.isFinite(Number(m.latitude)) && Number.isFinite(Number(m.longitude))) {
                                          setViewState((v) => ({ ...v, latitude: Number(m.latitude), longitude: Number(m.longitude), zoom: 16 }));
                                        }
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

                        {selectedLocationOnMap && Number.isFinite(Number(selectedLocationOnMap.latitude)) && Number.isFinite(Number(selectedLocationOnMap.longitude)) && (
                            <Popup
                                longitude={Number(selectedLocationOnMap.longitude)}
                                latitude={Number(selectedLocationOnMap.latitude)}
                                anchor="bottom"
                                closeButton={false}
                                offset={[-12, -53]}
                            >
                                <div className="place-popUp">
                                    {selectedLocationOnMap.image ? (
                                      <img
                                          src={selectedLocationOnMap.image}
                                          className="img-popUp"
                                          alt="Lugar actual"
                                      />
                                    ) : null}
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
