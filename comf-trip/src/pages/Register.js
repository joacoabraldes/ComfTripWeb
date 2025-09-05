// src/pages/RegisterPage.jsx (or src/pages/Register.js)
import React, { useState } from "react";
import { apiPost } from "./api";
import "../styles/register.css";

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    nationality: "",
    birthdate: "",
    agree: false,
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.agree) return setMessage("Por favor acepta los términos y condiciones.");
    setLoading(true);
    setMessage("");
    try {
      const res = await apiPost("/auth/register", form);
      setMessage(res?.message || "Usuario registrado correctamente");
    } catch (err) {
      setMessage(err?.message || "Error al registrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-root">
      {/* Topbar */}
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-left-buttons">
            <button aria-label="left-1" className="icon-small" style={{ background: "transparent", border: "none" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-gray-500">
                <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            <button aria-label="left-2" className="icon-small" style={{ background: "transparent", border: "none" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-gray-500">
                <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            <button aria-label="left-3" className="icon-small" style={{ background: "transparent", border: "none" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-gray-500">
                <rect x="4" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>

          <div className="brand-pill">
            <div className="brand-left">
              <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-60" style={{ marginRight: 6 }}>
                <path d="M10 3v2" stroke="#49454F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="brand-url">www.url.com</span>
            </div>
            <div style={{ width: 28 }} aria-hidden />
          </div>

          <div className="avatar">M</div>
          <button style={{ background: "transparent", border: "none", marginLeft: 8 }} aria-hidden>
            <div style={{ width: 4, height: 16, background: "#79747E" }} />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="main">
        <section className="left-column">
          <h1 className="title-big">Registrarse</h1>

          <p style={{ color: "#6B7280" }}>Crea tu cuenta para empezar a disfrutar de nuestros servicios.</p>

          <div>
            <div className="info-card">
              <p style={{ margin: 0, color: "#4B5563" }}>Añade tus datos personales y revisa los términos antes de continuar.</p>
            </div>
          </div>

          <div className="footer-cta">
            <span>Already a member? </span>
            <a href="#" style={{ color: "#FF3951", marginLeft: 6 }}>Log In</a>
          </div>
        </section>

        <section className="right-column">
          <form onSubmit={handleSubmit} className="form">
            <Field label="Nombre" name="name" value={form.name} onChange={handleChange} placeholder="Nombre" required />

            <Field label="Email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="Email" required />

            <Field label="Phone number" name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="Phone number" />

            <Field label="Contraseña" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Contraseña" required />

            <div className="grid-2">
              <Field label="Nacionalidad" name="nationality" value={form.nationality} onChange={handleChange} placeholder="Nacionalidad" />
              <Field label="Fecha de nacimiento" name="birthdate" type="date" value={form.birthdate} onChange={handleChange} placeholder="Fecha de nacimiento" />
            </div>

            <div className="agree">
              <input id="agree" name="agree" type="checkbox" checked={form.agree} onChange={handleChange} />
              <label htmlFor="agree" style={{ margin: 0 }}>
                By checking the box you agree to our <a href="#" style={{ color: "#FF3951" }}>Terms</a> and <a href="#" style={{ color: "#FF3951" }}>Conditions</a>.
              </label>
            </div>

            <div>
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? "Registrando…" : "Registrarme"}
              </button>
            </div>

            {message && <div className="message">{message}</div>}
          </form>
        </section>
      </main>
    </div>
  );
}

function Field({ label, name, type = "text", value, onChange, placeholder, required = false }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <div>
        <input
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          className="input"
        />
      </div>
    </label>
  );
}
