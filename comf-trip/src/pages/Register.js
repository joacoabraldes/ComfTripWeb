// src/pages/Register.jsx
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import countryList from "react-select-country-list";
import { apiPost } from "./api";
import "../styles/auth.css";
import LogoSvg from "../components/LogoSvg";

export default function Register() {
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
  const navigate = useNavigate();
  // opciones de países
  const options = useMemo(() => countryList().getData(), []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  function handleCountryChange(value) {
    setForm(f => ({ ...f, nationality: value.label }));
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.agree) return setMessage("Por favor acepta los términos y condiciones.");
    setLoading(true);
    setMessage("");

    try {
      // call backend register
      const res = await apiPost("/auth/register", {
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
        nationality: form.nationality,
        birthdate: form.birthdate || null,
      });

      // backend should return { token, user } according to your controller
      if (res.token) {
        localStorage.setItem("token", res.token);
      }
      if (res.user) {
        localStorage.setItem("user", JSON.stringify(res.user));
      }

      // navigate to interests so the user chooses interests first
      navigate("/interests");
    } catch (err) {
      // backend may return { message } or { error } or plain string
      const errMsg = err?.message || err?.error || (typeof err === "string" ? err : null);
      setMessage(errMsg || "Error al registrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-container">
        {/* LEFT: form */}
        <div className="auth-left">
          <h1 className="auth-title">Registrarse</h1>
          <p className="auth-sub">Crea tu cuenta para empezar a disfrutar de nuestros servicios.</p>

          <form className="form" onSubmit={handleSubmit}>
            <label className="field">
              <span className="field-label">Nombre</span>
              <input className="input" name="name" value={form.name} onChange={handleChange} placeholder="Nombre" required />
            </label>

            <label className="field">
              <span className="field-label">Email</span>
              <input className="input" name="email" type="email" value={form.email} onChange={handleChange} placeholder="Email" required />
            </label>

            <label className="field">
              <span className="field-label">Teléfono</span>
              <input className="input" name="phone" value={form.phone} onChange={handleChange} placeholder="Teléfono" />
            </label>

            <label className="field">
              <span className="field-label">Contraseña</span>
              <input className="input" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Contraseña" required />
            </label>

            <div className="grid-2">
              <label className="field">
                <span className="field-label">Nacionalidad</span>
                <Select
                    options={options}
                    value={options.find(opt => opt.label === form.nationality) || null}
                    onChange={handleCountryChange}
                    placeholder="Selecciona tu nacionalidad"
                />
              </label>

              <label className="field">
                <span className="field-label">Fecha de nacimiento</span>
                <input className="input" name="birthdate" type="date" value={form.birthdate} onChange={handleChange} />
              </label>
            </div>

            <label className="agree">
              <input id="agree" name="agree" type="checkbox" checked={form.agree} onChange={handleChange} />
              <span style={{fontSize:15}}>
                By checking the box you agree to our <button type="button" className="linkish" onClick={() => alert('Términos')}>Terms</button> and <button type="button" className="linkish" onClick={() => alert('Conditions')}>Conditions</button>.
              </span>
            </label>

            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Registrando…" : "Registrarme"}
            </button>

            {message && <div className="message">{message}</div>}
          </form>

          <div className="footer-cta">
            <span>Already a member?</span>
            <button className="linkish" onClick={() => navigate("/login")} style={{marginLeft:6}}>Log In</button>
          </div>
        </div>

        {/* RIGHT: art + logo */}
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
