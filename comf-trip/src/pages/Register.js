// src/pages/Register.jsx
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import countryList from "react-select-country-list";
import "../styles/auth.css";
import LogoSvg from "../components/LogoSvg";
import { useTranslation } from "../i18n";
import {useAuth} from "../auth/AuthProvider";

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
  const { t } = useTranslation();
    const { register} = useAuth();
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
    if (!form.agree) return setMessage(t('auth.register.agreeTermsError'));
    setLoading(true);
    setMessage("");

    try {
      // call backend register
      await register({
          name: form.name,
          email: form.email,
          phone: form.phone,
          password: form.password,
          nationality: form.nationality,
          birthdate: form.birthdate || null,
      });

      // navigate to interests so the user chooses interests first
      navigate("/interests");
    } catch (err) {
      // backend may return { message } or { error } or plain string
      const errMsg = err?.message || err?.error || (typeof err === "string" ? err : null);
      setMessage(errMsg || t('auth.register.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-container">
        {/* LEFT: form */}
        <div className="auth-left">
          <h1 className="auth-title">{t('auth.register.title')}</h1>
          <p className="auth-sub">{t('auth.register.subtitle')}</p>

          <form className="auth-form">
            <label className="auth-field">
              <span className="auth-field-label">{t('auth.register.name')}</span>
              <input className="input" name="name" value={form.name} onChange={handleChange} placeholder={t('auth.register.name')} required disabled={loading}/>
            </label>

            <label className="auth-field">
              <span className="auth-field-label">{t('auth.register.email')}</span>
              <input className="input" name="email" type="email" value={form.email} onChange={handleChange} placeholder={t('auth.register.email')} required disabled={loading}/>
            </label>

            <label className="auth-field">
              <span className="auth-field-label">{t('auth.register.phone')}</span>
              <input className="input" name="phone" value={form.phone} onChange={handleChange} placeholder={t('auth.register.phone')} disabled={loading} />
            </label>

            <label className="auth-field">
              <span className="auth-field-label">{t('auth.register.password')}</span>
              <input className="input" name="password" type="password" value={form.password} onChange={handleChange} placeholder={t('auth.register.password')} required  disabled={loading}/>
            </label>

            <div className="grid-2">
              <label className="auth-field">
                <span className="auth-field-label">{t('auth.register.nationality')}</span>
                <Select
                    className="dropdown-select"
                    classNamePrefix="react-select"
                    options={options}
                    value={options.find(opt => opt.label === form.nationality) || null}
                    onChange={handleCountryChange}
                    placeholder={t('auth.register.nationality')}
                    isDisabled={loading}
                />
              </label>

              <label className="auth-field">
                <span className="auth-field-label">{t('auth.register.birthdate')}</span>
                <input className="input" name="birthdate" type="date" value={form.birthdate} onChange={handleChange} disabled={loading} />
              </label>
            </div>

            <label className="agree">
              <input id="agree" name="agree" type="checkbox" checked={form.agree} onChange={handleChange} disabled={loading}/>
              <span style={{fontSize:15}}>
                {t('auth.register.agreeTerms')}
              </span>
            </label>

            <button type="submit" disabled={loading} className="auth-btn-primary" onClick={handleSubmit}>
              {loading ? t('auth.register.submitting') : t('auth.register.submit')}
            </button>

            {message && <div className="message">{message}</div>}
              <div className="footer-cta">
                  <span>{t('auth.register.alreadyMember')}</span>
                  <button className="linkish" onClick={() => navigate("/login")} style={{marginLeft:6, fontSize:"20px"}} disabled={loading}>{t('auth.register.logIn')}</button>
              </div>
          </form>
        </div>

        {/* RIGHT: art + logo */}
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
