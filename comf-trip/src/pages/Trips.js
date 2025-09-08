// src/pages/Trips.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import MapSvg from "../components/MapSvg";
import "../styles/trips.css";
import Hamburger from "../components/icons/Hamburger";
import UserIcon from "../components/icons/UserIcon";
import Sidebar from "../components/Sidebar";


export default function Trips() {
    const [menuAbierto, setMenuAbierto] = useState(false);
    const navigate = useNavigate();
  return (
    <div className="trips-root">
        {/* Sidebar */}
        <Sidebar open={menuAbierto} onClose={() => setMenuAbierto(false)} />

        {/* Header icons */}
        <div className="trips-header">
            <button
                className="icon-btn icon-left"
                aria-label="menu"
                onClick={() => setMenuAbierto(!menuAbierto)}
            >
                <Hamburger />
            </button>

            {/* Botón perfil: va a la página de perfil */}
            <button
                className="icon-btn icon-right"
                aria-label="profile"
                onClick={() => navigate("/profile")}
            >
                <UserIcon />
            </button>
        </div>

      {/* main content area */}
      <main className="trips-main">
        <section className="trips-left">
          <div className="trips-message">
            No tienes ningún viaje activo actualmente
            <br />
            ¡Planea tu siguiente viaje!
          </div>
        </section>

        <section className="trips-right">
          <div className="map-wrapper" aria-hidden>
            <MapSvg width={799} height={600} />
          </div>
        </section>
      </main>

      {/* CTA button */}
      <div className="trips-cta">
        <button
          className="btn-newtrip"
          onClick={() => {
            /* replace with your navigation logic */
            alert("Nuevo Viaje - implement navigation");
          }}
        >
          Nuevo Viaje &nbsp; &gt;
        </button>
      </div>
    </div>
  );
}
