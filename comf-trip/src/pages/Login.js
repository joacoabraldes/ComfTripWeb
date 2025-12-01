// src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/auth.css";
import LogoSvg from "../components/LogoSvg";
import { useAuth } from "../auth/AuthProvider";
import { useTranslation } from "../i18n";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" }); // 'email' here is the identifier (username or email)
  const nav = useNavigate();
  const { login} = useAuth();
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

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
        <div className="auth-left">
          <h1 className="auth-title">{t('auth.login.title')}</h1>

          <form className="auth-form">
            <label className="auth-field">
              <span className="auth-field-label">{t('auth.login.usernameOrEmail')}</span>
              <input
                className="input"
                name="email" // kept the same name to minimize other changes; this is the identifier
                placeholder={t('auth.login.usernameOrEmail')}
                onChange={handle}
                type="text"         // <-- changed from "email" to "text"
                autoComplete="username"
                aria-label={t('auth.login.usernameOrEmail')}
                required
                disabled={loading}
              />
            </label>

            <label className="auth-field">
              <span className="auth-field-label">{t('auth.login.password')}</span>
              <input
                className="input"
                name="password"
                placeholder={t('auth.login.password')}
                type="password"
                onChange={handle}
                autoComplete="current-password"
                required
                disabled={loading}
              />
            </label>

            <button type="forgot" className="forgot">{t('auth.login.forgotPassword')}</button>

            <button type="submit" onClick={submit} className="auth-btn-primary login" disabled={loading}>
              {loading ? t('auth.login.submitting') : t('auth.login.submit')}
            </button>
            <div className="footer-cta">
              <span>{t('auth.login.notRegistered')}</span>
              <button className="linkish" onClick={() => nav("/register")} style={{marginLeft:6, fontSize:"20px"}} disabled={loading}>{t('auth.login.register')}</button>
            </div>
          </form>
        </div>

        <div className="auth-right">
            <div className="hero-art" aria-hidden>
              <LogoSvg />
            </div>
            <div className="brand">ComfTrip</div>
        </div>
      </div>
    </div>
  );
}
