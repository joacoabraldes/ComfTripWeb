// src/pages/RegisterPage.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "./api";
import "../styles/auth.css";
import LogoSvg from "../components/LogoSvg";


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
  const navigate = useNavigate();

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
      navigate("/trips"); // Redirect after successful registration
    } catch (err) {
      setMessage(err?.message || "Error al registrar");
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
              <span className="field-label">Phone number</span>
              <input className="input" name="phone" value={form.phone} onChange={handleChange} placeholder="Phone number" />
            </label>

            <label className="field">
              <span className="field-label">Contraseña</span>
              <input className="input" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Contraseña" required />
            </label>

            <div className="grid-2">
              <label className="field">
                <span className="field-label">Nacionalidad</span>
                <input className="input" name="nationality" value={form.nationality} onChange={handleChange} placeholder="Nacionalidad" />
              </label>

              <label className="field">
                <span className="field-label">Fecha de nacimiento</span>
                <input className="input" name="birthdate" type="date" value={form.birthdate} onChange={handleChange} />
              </label>
            </div>

            <label className="agree">
              <input id="agree" name="agree" type="checkbox" checked={form.agree} onChange={handleChange} />
              <span style={{fontSize:15}}>
                By checking the box you agree to our <a href="#" style={{ color: "#FF3951", textDecoration:'none' }}>Terms</a> and <a href="#" style={{ color: "#FF3951", textDecoration:'none' }}>Conditions</a>.
              </span>
            </label>

            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Registrando…" : "Registrarme"}
            </button>

            {message && <div className="message">{message}</div>}
          </form>

          <div className="footer-cta">
            <span>Already a member?</span>
            <a href="#" style={{marginLeft:6}}>Log In</a>
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