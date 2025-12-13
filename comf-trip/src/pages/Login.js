// src/pages/Login.jsx
import React, {useState, useMemo, useEffect} from "react";
import { useNavigate } from "react-router-dom";
import "../styles/auth.css";
import LogoSvg from "../components/LogoSvg";
import { useAuth } from "../auth/AuthProvider";
import { useTranslation } from "../i18n";
import InputField from "../components/forms/InputField";
import FilterSelect from "../components/FilterSelect";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" }); // 'email' here is the identifier (username or email)
  const nav = useNavigate();
  const { login} = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { t, language, setLanguage } = useTranslation();
    const [message, setMessage] = useState("");
    const [errorIdentifier, setErrorIdentifier]=useState(null)
    const [errorPassword, setErrorPassword]=useState(null)
    const [onEmail, setOnEmail]=useState(false)
    const [onPassword, setOnPassword]=useState(false)

  const handle = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
      if(e.target.name==="password"){
          setOnPassword(true)
      }
      if(e.target.name==="email"){
          setOnEmail(true)
      }
  }

  // Validar que los campos estén completos
  const isFormValid = useMemo(() => {
    const identifier = (form.email || "").trim();
    const password = (form.password || "").trim();
    return identifier.length > 0 && password.length > 0;
  }, [form.email, form.password]);
    useEffect(() => {
        if (onPassword) {
            if (form.password.trim().length === 0) {
                setErrorPassword("auth.errors.passwordRequired")
            }else {
                setErrorPassword(null)
            }
        }
        if (onEmail) {
            if (form.email.trim().length === 0 && onEmail) {
                setErrorIdentifier("auth.errors.identifierRequired")
            } else {
                setErrorIdentifier(null)
            }
        }
    }, [form, t]);

  const submit = async (e) => {
    e.preventDefault();
    if(!isFormValid) {
        if (form.password.trim().length === 0) {
            setErrorPassword("auth.errors.passwordRequired")
        }
        if (form.email.trim().length === 0) {
            setErrorIdentifier("auth.errors.identifierRequired")
        }
        setMessage("auth.register.completeFields");
        return
    }
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
          <div className="auth-header">
            <h1 className="auth-title" >{t('auth.login.title')}</h1>
              <FilterSelect
                value={language}
                onChange={setLanguage}
                options={[
                  { value: 'es', label: t('profile.spanish') },
                  { value: 'en', label: t('profile.english') },
                ]}
                isClearable={false}
                disabled={loading}
              />
          </div>

          <form className="auth-form">
            <InputField
              label={t('auth.login.usernameOrEmail')}
              name="email"
              placeholder={t('auth.login.usernameOrEmail')}
              onChange={handle}
              type="text"
              autoComplete="username"
              error={errorIdentifier ? t(errorIdentifier) : null}
              disabled={loading}
            />

            <InputField
              label={t('auth.login.password')}
              name="password"
              placeholder={t('auth.login.password')}
              onChange={handle}
              autoComplete="current-password"
              showPasswordToggle
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword(!showPassword)}
              error={errorPassword ? t(errorPassword) : null}
              disabled={loading}
            />

            <button 
              type="button" 
              className="forgot"
              onClick={() => nav("/recover-password")}
              disabled={loading}
            >
              {t('auth.login.forgotPassword')}
            </button>

            <button type="submit" onClick={submit} className="auth-btn-primary login" disabled={loading}>
              {loading ? t('auth.login.submitting') : t('auth.login.submit')}
            </button>
              {message && <div className="message">{t(message)}</div>}
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
