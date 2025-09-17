// src/pages/Home.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/home.css";

import UserIcon from "../components/icons/UserIcon";
import Header from "../components/Header";

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="home-root">
      {/* Sidebar that slides in/out */}
      <Header/>

      {/* Main hero content */}
      <main className="hero">
        <div className="hero-text">
          No tienes ningún viaje activo actualmente
          <br />
          <strong style={{ display: "block", marginTop: 12 }}>
            ¡Planea tu siguiente viaje!
          </strong>
        </div>

       
      </main>

      {/* CTA centered near the bottom */}
      <div className="cta">
        <button
          className="btn-primary"
          onClick={() => navigate("/add-trip")}
          aria-label="Nuevo viaje"
        >
          Nuevo Viaje
        </button>
      </div>
    </div>
  );
}
