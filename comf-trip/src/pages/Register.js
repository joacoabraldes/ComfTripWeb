// src/pages/Register.jsx
import React, {useState, useMemo, useEffect} from "react";
import { useNavigate } from "react-router-dom";
import "../styles/auth.css";
import LogoSvg from "../components/LogoSvg";
import { useTranslation } from "../i18n";
import { useAuth } from "../auth/AuthProvider";
import PhoneField from "../components/forms/PhoneField";
import InputField from "../components/forms/InputField";
import NationalityField from "../components/forms/NationalityField";
import FilterSelect from "../components/FilterSelect";

export default function Register() {
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    phoneCode: "+1",
    phoneNumber: "",
    nationality: "",
    birthdate: "",
    agree: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
    const { t, language, setLanguage } = useTranslation();
  const { register } = useAuth();
  const [errorName, setErrorName]=useState(null)
    const [errorEmail, setErrorEmail]=useState(null)
    const [errorPassword, setErrorPassword]=useState(null)
    const [errorConfirmPassword, setErrorConfirmPassword]=useState(null)
    const [onName, setOnName]=useState(false)
    const [onEmail, setOnEmail]=useState(false)
    const [onPassword, setOnPassword]=useState(false)
    const [onConfirmPassword, setOnConfirmPassword]=useState(false)
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
      if(name==="password"){
          setOnPassword(true)
      }
      if(name==="confirmPassword"){
          setOnConfirmPassword(true)
      }
      if(name==="username"){
          setOnName(true)
      }
      if(name==="email"){
          setOnEmail(true)
      }
  };

  function handleNationalityChange(nationality) {
    setForm((f) => ({ ...f, nationality }));
  }

    useEffect(() => {
        if (onPassword) {
            if (form.password.trim().length === 0) {
                setErrorPassword("auth.errors.passwordRequired")
            } else if (form.password.trim().length < 6) {
                setErrorPassword("auth.errors.passwordMinLength")
            } else {
                setErrorPassword(null)
            }
        }
        if (onConfirmPassword) {
            if (form.password !== form.confirmPassword) {
                if (form.confirmPassword.trim().length === 0) {
                    setErrorConfirmPassword("auth.errors.confirmPasswordRequired")
                } else {
                    setErrorConfirmPassword("auth.errors.passwordsNotMatch")
                }
            } else {
                setErrorConfirmPassword(null)
            }
        }
        if (onName) {
            if (form.username.trim().length === 0) {
                setErrorName("auth.errors.usernameRequired")
            } else {
                setErrorName(null)
            }
        }
        if (onEmail) {
            if (form.email.trim().length === 0) {
                setErrorEmail("auth.errors.emailRequired")
            } else if (!EMAIL_REGEX.test(form.email.trim())) {
                setErrorEmail("auth.errors.invalidEmail");
            } else {
                setErrorEmail(null)
            }
        }
    }, [form]);

  const isFormValid = useMemo(() => {
    return (
      form.username.trim().length > 0 &&
      form.email.trim().length > 0 &&
      form.password.trim().length >= 6 &&
      form.confirmPassword.trim().length >= 6 &&
      form.password === form.confirmPassword
    );
  }, [form]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorName(null);
    setErrorEmail(null);
    setErrorPassword(null);
    setErrorConfirmPassword(null)
    if (!isFormValid) {
        if (form.password.trim().length === 0) {
            setErrorPassword("auth.errors.passwordRequired")
        }
        if (form.email.trim().length === 0) {
            setErrorEmail("auth.errors.emailRequired")
        }
        if (form.username.trim().length === 0) {
            setErrorName("auth.errors.usernameRequired")
        }
        if (form.confirmPassword.trim().length === 0) {
            setErrorConfirmPassword("auth.errors.confirmPasswordRequired")
        }
      setMessage("auth.register.completeFields");
      return
    }
      if (!form.agree) return  setMessage("auth.register.agreeTermsError");
    setLoading(true);
    setMessage("");

    try {
      // Combinar phoneCode y phoneNumber
      const phoneCode = form.phoneCode || '+1';
      const phoneNumber = form.phoneNumber || '';
      const phone = phoneNumber.trim() ? `${phoneCode}${phoneNumber.trim()}` : null;

      await register({
        username: form.username.trim(),
        email: form.email.trim(),
        phone: phone,
        password: form.password,
        nationality: form.nationality || null,
        birthdate: form.birthdate || null,
      });

      navigate("/interests");
    } catch (err) {
      const errMsg =
        err?.message || err?.error || (typeof err === "string" ? err : null);
      setMessage(errMsg || "auth.register.error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-container">
        {/* LEFT: form */}
        <div className="auth-left">
            <div className="auth-header">
                <h1 className="auth-title" style={{ margin: 0 }}>{t("auth.register.title")}</h1>
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
          <p className="auth-sub">{t("auth.register.subtitle")}</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <InputField
              label={t("auth.register.username")}
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder={t("auth.register.usernamePlaceholder")}
              disabled={loading}
              error={errorName ? t(errorName) : null}
            />

            <InputField
              label={t("auth.register.email")}
              name="email"
              type="text"
              value={form.email}
              onChange={handleChange}
              placeholder={t("auth.register.emailPlaceholder")}
              disabled={loading}
              error={errorEmail ? t(errorEmail) : null}
            />

            <div className="auth-field">
              <span className="auth-field-label">
                {t("auth.register.phone")}
              </span>
              <PhoneField
                code={form.phoneCode}
                value={form.phoneNumber}
                onCodeChange={(code) => setForm((f) => ({ ...f, phoneCode: code }))}
                onNumberChange={(number) => setForm((f) => ({ ...f, phoneNumber: number }))}
                placeholder={t("auth.register.phoneNumber")}
                inputHeight={50}
                disabled={loading}
              />
            </div>

            <InputField
              label={t("auth.register.password")}
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder={t("auth.register.password")}
              showPasswordToggle
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword(!showPassword)}
              disabled={loading}
              error={errorPassword ? t(errorPassword) : null}
            />

            <InputField
              label={t("auth.register.confirmPassword")}
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder={t("auth.register.confirmPassword")}
              showPasswordToggle
              showPassword={showConfirmPassword}
              onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={loading}
              error={errorConfirmPassword ? t(errorConfirmPassword) : null}
            />

            <div className="grid-2">
              <NationalityField
                label={t("auth.register.nationality")}
                value={form.nationality}
                onChange={handleNationalityChange}
                placeholder={t("auth.register.selectNationality")}
                disabled={loading}
              />

              <InputField
                label={t("auth.register.birthdate")}
                name="birthdate"
                type="date"
                value={form.birthdate}
                onChange={handleChange}
                disabled={loading}
              />
            </div>

            <label className="agree">
              <input
                id="agree"
                name="agree"
                type="checkbox"
                checked={form.agree}
                onChange={handleChange}
                disabled={loading}
              />
              <span style={{ fontSize: 15 }}>
                {t("auth.register.agreeTerms")}
              </span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="auth-btn-primary"
            >
              {loading
                ? t("auth.register.submitting")
                : t("auth.register.submit")}
            </button>

            {message && <div className="message">{t(message)}</div>}
            <div className="footer-cta">
              <span>{t("auth.register.alreadyMember")}</span>
              <button
                className="linkish"
                onClick={() => navigate("/login")}
                style={{ marginLeft: 6, fontSize: "20px" }}
                disabled={loading}
              >
                {t("auth.register.logIn")}
              </button>
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
