// src/pages/Error.jsx
import React from "react";
import { Link } from "react-router-dom";
import "../styles/auth.css"; // optional if you want consistent styles

const Error = () => {
  return (
    <div style={container}>
      <div style={box}>
        <h1 style={{ margin: 0 }}>Sin permiso</h1>
        <p style={{ color: "#555", marginTop: 12 }}>
          No tienes permiso para ver esta página. Por favor inicia sesión o regístrate.
        </p>

        <div style={{ marginTop: 20, display: "flex", gap: 12, justifyContent: "center" }}>
          <Link to="/login" style={primaryBtn}>
            Iniciar sesión
          </Link>
          <Link to="/register" style={outlineBtn}>
            Registrarse
          </Link>
        </div>
      </div>
    </div>
  );
};

const container = {
  minHeight: "80vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

const box = {
  textAlign: "center",
  padding: 36,
  borderRadius: 12,
  background: "#fff",
  boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
  maxWidth: 680,
};

const primaryBtn = {
  background: "#ff3951",
  color: "#fff",
  padding: "12px 18px",
  borderRadius: 8,
  textDecoration: "none",
  fontWeight: 500,
};

const outlineBtn = {
  background: "transparent",
  color: "#333",
  padding: "12px 18px",
  borderRadius: 8,
  textDecoration: "none",
  border: "1px solid #eee",
};

export default Error;
