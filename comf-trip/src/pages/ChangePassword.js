// src/pages/ChangePassword.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPut } from "./api";
import "../styles/changePassword.css";
import Header from "../components/Header";
import "../styles/header.css";

export default function ChangePassword() {
  const navigate = useNavigate();
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
      <Header/>

      <main className="change-container">
        <button className="back-btn" onClick={() => navigate(-1)} aria-label="volver">←</button>

        <h1 className="change-title">Cambiar contraseña</h1>

        <form className="change-form" onSubmit={handleSubmit}>

          <label className="change-field">
            <div className="change-field-label">Contraseña actual</div>
            <input
              type="password"
              name="currentPassword"
              className={"input"}
              value={form.currentPassword}
              onChange={handleChange}
              placeholder="Ingrese la contraseña actual"
              required
              disabled={loading}
            />
          </label>

          <label className="change-field">
            <div className="change-field-label">Nueva contraseña</div>
            <input
              type="password"
              name="newPassword"
              value={form.newPassword}
              className={"input"}
              onChange={handleChange}
              placeholder="Ingrese la nueva contraseña"
              required
              disabled={loading}
            />
          </label>

          <label className="change-field">
            <div className="change-field-label">Confirmar nueva contraseña</div>
            <input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              className={"input"}
              onChange={handleChange}
              placeholder="Confirme su nueva contraseña"
              required
              disabled={loading}
            />
          </label>

          <div className="form-actions">
            <button type="submit" className="edit-btn-primary" disabled={loading}>
              {loading ? "Guardando…" : "Confirmar"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
