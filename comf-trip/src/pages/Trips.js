// src/pages/Trips.jsx
import React from "react";
import MapSvg from "../components/MapSvg";
import "../styles/trips.css";
import Hamburger from "../components/icons/Hamburger";
import UserIcon from "../components/icons/UserIcon";

export default function Trips() {
  return (
    <div className="trips-root">
      {/* header icons */}
      <div className="trips-header">
        <button className="icon-btn icon-left" aria-label="menu">
          <Hamburger />
        </button>

        <button className="icon-btn icon-right" aria-label="profile">
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
