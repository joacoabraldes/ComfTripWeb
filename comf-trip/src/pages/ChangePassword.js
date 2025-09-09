// src/pages/ChangePassword.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPut } from "./api";
import "../styles/changePassword.css";
import Sidebar from "../components/Sidebar";
import Hamburger from "../components/icons/Hamburger";
import UserIcon from "../components/icons/UserIcon";

export default function ChangePassword() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const stored = JSON.parse(localStorage.getItem("user") || "null") || {};
    if (!stored || !stored.id) {
      alert("Usuario no identificado. Por favor inicia sesión.");
      navigate("/login");
      return;
    }

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      alert("Complete todos los campos.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      alert("La nueva contraseña y su confirmación no coinciden.");
      return;
    }

    setLoading(true);
    try {
      // backend expects { oldPassword, newPassword }
      await apiPut(`/users/${stored.id}/password`, {
        oldPassword: form.currentPassword,
        newPassword: form.newPassword
      });

      // success
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      alert("Contraseña cambiada correctamente.");
      navigate("/profile");
    } catch (err) {
      // err may be object or string — normalize message
      let message = "Error cambiando la contraseña";
      if (err && typeof err === "object") {
        // If your backend returns { message: "..." } or { error: "..." }
        message = err.message || err.error || JSON.stringify(err);
      } else if (typeof err === "string") {
        message = err;
      }
      // specific handling for auth errors
      if (message.toLowerCase().includes("no token") ||
          message.toLowerCase().includes("token inválido") ||
          message.toLowerCase().includes("no autorizado") ||
          message.toLowerCase().includes("401") ||
          message.toLowerCase().includes("403")) {
        alert("Sesión inválida. Por favor inicia sesión nuevamente.");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
        return;
      }

      alert(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="change-root">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="trips-header">
        <button className="icon-btn icon-left" aria-label="menu" onClick={() => setMenuOpen(v => !v)}>
          <Hamburger />
        </button>

        <button className="icon-btn icon-right" aria-label="profile" onClick={() => navigate("/profile")}>
          <UserIcon />
        </button>
      </div>

      <main className="change-container">
        <button className="back-btn" onClick={() => navigate(-1)} aria-label="volver">←</button>

        <h1 className="change-title">Cambiar contraseña</h1>

        <form className="change-form" onSubmit={handleSubmit}>

          <label className="field">
            <div className="field-label">Contraseña actual</div>
            <input
              type="password"
              name="currentPassword"
              value={form.currentPassword}
              onChange={handleChange}
              placeholder="Ingrese la contraseña actual"
              required
            />
          </label>

          <label className="field">
            <div className="field-label">Nueva contraseña</div>
            <input
              type="password"
              name="newPassword"
              value={form.newPassword}
              onChange={handleChange}
              placeholder="Ingrese la nueva contraseña"
              required
            />
          </label>

          <label className="field">
            <div className="field-label">Confirmar nueva contraseña</div>
            <input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Confirme su nueva contraseña"
              required
            />
          </label>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Guardando…" : "Confirmar"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
