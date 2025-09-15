// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/auth.css";
import LogoSvg from "../components/LogoSvg";
import { useAuth } from "../auth/AuthProvider";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" }); // 'email' here is the identifier (username or email)
  const nav = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const handle = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const identifier = (form.email || "").trim();
      // If identifier contains '@' treat it as an email, otherwise as username
      const payload = identifier.includes("@")
        ? { email: identifier, password: form.password }
        : { username: identifier, password: form.password };

      await login(payload);
      // on success, go to trips
      nav("/home");
    } catch (err) {
      alert(err.message || JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-container">
        {/* LEFT: login form */}
        <div className="auth-left">
          <h1 className="auth-title">Iniciar Sesion</h1>

          <form className="form" onSubmit={submit}>
            <label className="field">
              <span className="field-label">Nombre de usuario o Email</span>
              <input
                className="input"
                name="email" // kept the same name to minimize other changes; this is the identifier
                placeholder="Nombre de usuario o Email"
                onChange={handle}
                type="text"         // <-- changed from "email" to "text"
                autoComplete="username"
                aria-label="Nombre de usuario o Email"
                required
              />
            </label>

            <label className="field">
              <span className="field-label">Contraseña</span>
              <input
                className="input"
                name="password"
                placeholder="Contraseña"
                type="password"
                onChange={handle}
                autoComplete="current-password"
                required
              />
            </label>

            <div className="forgot">¿Olvidaste tu contraseña?</div>

            <button type="submit" className="btn-primary login" disabled={loading}>
              {loading ? "Entrando..." : "Iniciar"}
            </button>
          </form>
        </div>

        {/* RIGHT: artwork + logo */}
        <div className="auth-right">
          <div>
            <div className="hero-art" aria-hidden>
              <LogoSvg />
            </div>
            <div className="brand">ComfTrip</div>
          </div>
        </div>
      </div>
    </div>
  );
}
