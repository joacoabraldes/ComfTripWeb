// src/pages/Home.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/home.css";

import Sidebar from "../components/Sidebar";
import Hamburger from "../components/icons/Hamburger";
import UserIcon from "../components/icons/UserIcon";

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="home-root">
      {/* Sidebar that slides in/out */}
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Header (fixed) */}
      <header className="home-header">
        <div className="left">
          <button
            className="icon-btn"
            aria-label="Abrir menú"
            onClick={() => setMenuOpen((v) => !v)}
            title="Menú"
          >
            <Hamburger />
          </button>
        </div>

        <div className="right">
          <button
            className="icon-btn profile"
            aria-label="Perfil"
            title="Perfil"
            onClick={() => navigate("/profile")}
          >
            <UserIcon />
          </button>
        </div>
      </header>

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
