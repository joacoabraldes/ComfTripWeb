// src/pages/Login.jsx
import React, { useState } from 'react';
import { apiPost } from './api';
import { useNavigate } from 'react-router-dom';
import "../styles/auth.css";
import LogoSvg from "../components/LogoSvg";



export default function Login(){
  const [form, setForm] = useState({email:'', password:''});
  const nav = useNavigate();

  const handle = e => setForm({...form, [e.target.name]: e.target.value});
  const submit = async (e) => {
    e.preventDefault();
    try {
      const res = await apiPost('/auth/login', form);
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      nav('/trips');
    } catch (err) { alert(err.message || JSON.stringify(err)); }
  };

  return (
    <div className="auth-root">
      <div className="auth-container">

        {/* LEFT: login form */}
        <div className="auth-left">
          <h1 className="auth-title">Iniciar Sesion</h1>

          <form className="form" onSubmit={submit}>
            <label className="field">
              <span className="field-label">Nombre de Usuario o mail</span>
              <input className="input" name="email" placeholder="Nombre de Usuario o mail" onChange={handle} type="email" required />
            </label>

            <label className="field">
              <span className="field-label">Contraseña</span>
              <input className="input" name="password" placeholder="Contraseña" type="password" onChange={handle} required />
            </label>

            <div className="forgot">¿Olvidare tu contraseña?</div>

            <button type="submit" className="btn-primary login">Iniciar</button>
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
