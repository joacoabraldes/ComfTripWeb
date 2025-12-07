// src/pages/RecoverPassword.jsx
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/auth.css";
import LogoSvg from "../components/LogoSvg";
import { useTranslation } from "../i18n";
import { apiPost } from "./api";
import InputField from "../components/forms/InputField";

export default function RecoverPassword() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Validate email format function
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Validate email format
  const isEmailValid = useMemo(() => {
    if (!email.trim()) return false;
    return validateEmail(email);
  }, [email]);

  // Validate form - all fields must be filled and passwords must match
  const isFormValid = useMemo(() => {
    return (
      email.trim().length > 0 &&
      code.trim().length > 0 &&
      newPassword.trim().length >= 6 &&
      confirmPassword.trim().length >= 6 &&
      newPassword === confirmPassword
    );
  }, [email, code, newPassword, confirmPassword]);

  // Timer for resend cooldown
  React.useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSendCode = async () => {
    if (!email.trim()) {
      setMessage(t('auth.recoverPassword.enterEmail'));
      return;
    }

    if (!validateEmail(email)) {
      setMessage(t('auth.recoverPassword.invalidEmail'));
      return;
    }

    if (resendCooldown > 0) return;

    setSendingCode(true);
    setMessage('');
    try {
      const res = await apiPost('/auth/forgot-password', { email: email.trim().toLowerCase() });
      const data = res.data ?? res;
      
      if (data?.message || data?.success || res.data !== undefined) {
        setResendCooldown(30); // 30 seconds cooldown
        setMessage(t('auth.recoverPassword.codeSent') || 'Código enviado');
      }
    } catch (err) {
      console.error('Send code error', err);
      const msg = (err && err.message) || (err && err.error) || JSON.stringify(err) || t('auth.recoverPassword.requestFailed');
      setMessage(msg);
    } finally {
      setSendingCode(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      setMessage(t('auth.recoverPassword.enterCode') || 'Por favor ingresa el código de verificación');
      return;
    }

    if (!newPassword.trim() || !confirmPassword.trim()) {
      setMessage(t('auth.recoverPassword.completeAllFields') || 'Por favor completa todos los campos');
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage(t('auth.recoverPassword.passwordsDoNotMatch') || 'Las contraseñas no coinciden');
      return;
    }

    if (newPassword.length < 6) {
      setMessage(t('auth.recoverPassword.passwordTooShort') || 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      const res = await apiPost('/auth/reset-password', {
        email: email.trim().toLowerCase(),
        code: code.trim(),
        newPassword: newPassword.trim(),
      });
      const data = res.data ?? res;
      
      if (data?.message || data?.success || res.data !== undefined) {
        alert(t('auth.recoverPassword.passwordResetSuccess') || 'Tu contraseña ha sido actualizada correctamente');
        navigate("/login");
      }
    } catch (err) {
      console.error('Reset password error', err);
      const msg = (err && err.message) || (err && err.error) || JSON.stringify(err) || t('auth.recoverPassword.resetFailed') || 'Error al restablecer la contraseña';
      setMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-container">
        {/* LEFT: form */}
        <div className="auth-left">
          <h1 className="auth-title">{t('auth.recoverPassword.title')}</h1>
          <p className="auth-sub">{t('auth.recoverPassword.subtitle') || 'Ingresa tu email y te enviaremos un código de verificación'}</p>

          <form className="auth-form" onSubmit={handleResetPassword}>
            <InputField
              label={t('auth.recoverPassword.emailPlaceholder')}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.recoverPassword.emailPlaceholder')}
              required
              disabled={loading || sendingCode}
            />

            {/* Code input with send/resend button */}
            <label className="auth-field">
              <span className="auth-field-label">
                {t('auth.recoverPassword.codePlaceholder') || 'Código de verificación'}
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                <input
                  className="input"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={t('auth.recoverPassword.codePlaceholder') || 'Código de verificación'}
                  maxLength={6}
                  style={{ flex: 1 }}
                  required
                  disabled={loading || sendingCode}
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={resendCooldown > 0 || sendingCode || !isEmailValid}
                  className="auth-btn-secondary"
                  style={{
                    padding: '0 16px',
                    whiteSpace: 'nowrap',
                    opacity: (resendCooldown > 0 || !isEmailValid) ? 0.5 : 1,
                    cursor: (resendCooldown > 0 || sendingCode || !isEmailValid) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {sendingCode ? (
                    t('auth.recoverPassword.sendingButton') || 'Enviando...'
                  ) : (
                    resendCooldown > 0
                      ? (t('auth.recoverPassword.resendIn') || 'Reenviar ({seconds}s)').replace('{seconds}', resendCooldown.toString())
                      : t('auth.recoverPassword.sendButton') || 'Enviar'
                  )}
                </button>
              </div>
            </label>

            <InputField
              label={t('auth.recoverPassword.newPassword') || 'Nueva contraseña'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('auth.recoverPassword.newPassword') || 'Nueva contraseña'}
              showPasswordToggle
              showPassword={showNewPassword}
              onTogglePassword={() => setShowNewPassword(!showNewPassword)}
              required
              disabled={loading || sendingCode}
            />

            <InputField
              label={t('auth.recoverPassword.confirmPassword') || 'Confirmar contraseña'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('auth.recoverPassword.confirmPassword') || 'Confirmar contraseña'}
              showPasswordToggle
              showPassword={showConfirmPassword}
              onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
              required
              disabled={loading || sendingCode}
            />

            <button
              type="submit"
              disabled={loading || !isFormValid}
              className="auth-btn-primary"
            >
              {loading
                ? (t('auth.recoverPassword.changing') || 'Cambiando...')
                : t('auth.recoverPassword.confirmButton') || 'Confirmar'}
            </button>

            {message && <div className="message">{message}</div>}
            <div className="footer-cta">
              <button
                type="button"
                className="linkish"
                onClick={() => navigate("/login")}
                style={{ fontSize: "16px" }}
                disabled={loading || sendingCode}
              >
                {t('auth.recoverPassword.backToLogin')}
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

