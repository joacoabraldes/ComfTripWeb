// src/pages/Map.jsx
import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/map.css"; // create/extend this file if needed
import Sidebar from "../components/Sidebar";
import Hamburger from "../components/icons/Hamburger";
import UserIcon from "../components/icons/UserIcon";
import { useNavigate } from "react-router-dom";

/**
 * Fix default marker icon paths for many bundlers (CRA/Vite)
 */
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

function DraggableMarker({ position, setPosition }) {
  const [draggable, setDraggable] = useState(true);

  function eventHandlers() {
    return {
      dragend(e) {
        const marker = e.target;
        const latlng = marker.getLatLng();
        setPosition([latlng.lat, latlng.lng]);
      }
    };
  }

  return position ? (
    <Marker
      position={position}
      draggable={draggable}
      eventHandlers={eventHandlers()}
    >
      <Popup>
        Lat: {position[0].toFixed(5)} <br /> Lon: {position[1].toFixed(5)}
      </Popup>
    </Marker>
  ) : null;
}

export default function MapPage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Default center (you can use geolocation)
  const [position, setPosition] = useState([ -34.6037, -58.3816 ]); // Buenos Aires as example
  const [zoom, setZoom] = useState(6);

  // optional: center on user's geolocation if allowed
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPosition([pos.coords.latitude, pos.coords.longitude]);
          setZoom(13);
        },
        () => {
          // ignore errors, keep default
        }
      );
    }
  }, []);

  return (
    <div className="map-root">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="trips-header">
        <button className="icon-btn icon-left" aria-label="menu" onClick={() => setMenuOpen(v => !v)}>
          <Hamburger />
        </button>

        <button className="icon-btn icon-right" aria-label="profile" onClick={() => navigate("/profile")}>
          <UserIcon />
        </button>
      </div>

      <main className="map-main">
        <section className="map-left">
          <h2>No tienes viajes</h2>
          <p>Explora el mapa, arrastra el marcador o haz zoom para elegir un lugar.</p>
        </section>

        <section className="map-canvas">
          <MapContainer center={position} zoom={zoom} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <DraggableMarker position={position} setPosition={setPosition} />
          </MapContainer>
        </section>
      </main>
    </div>
  );
}
