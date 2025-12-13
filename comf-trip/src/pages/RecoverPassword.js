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

    const [errorCode, setErrorCode]=useState(null)
    const [errorEmail, setErrorEmail]=useState(null)
    const [errorPassword, setErrorPassword]=useState(null)
    const [errorConfirmPassword, setErrorConfirmPassword]=useState(null)
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Validate email format function
  const validateEmail = (email) => {
    return EMAIL_REGEX.test(email);
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
        setErrorEmail('auth.recoverPassword.enterEmail')
        return;
    }else if (!validateEmail(email)) {
        setErrorEmail('auth.recoverPassword.invalidEmail')
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

      if (!email.trim()) {
          setErrorEmail('auth.recoverPassword.enterEmail')
      }else if (!validateEmail(email)) {
          setErrorEmail('auth.recoverPassword.invalidEmail')
      }
    if (!code.trim()) {
        setErrorCode('auth.recoverPassword.enterCode')
    }

      if (!newPassword.trim()) {
          setErrorPassword("auth.errors.passwordRequired")
      } else if (newPassword.trim().length < 6) {
          setErrorPassword('auth.recoverPassword.passwordTooShort')
      } else {
          setErrorPassword(null)
      }

      if(!confirmPassword.trim()){
          setErrorConfirmPassword("auth.errors.confirmPasswordRequired")
      }else if (newPassword !== confirmPassword) {
          setErrorConfirmPassword('auth.recoverPassword.passwordsDoNotMatch')
      }

      if(!isFormValid){
          setMessage( 'auth.recoverPassword.completeAllFields' || 'Por favor completa todos los campos');
          return
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

              {/* Email input with send/resend button */}
              <label className="auth-field">
              <span className="auth-field-label">
                {t('auth.recoverPassword.emailPlaceholder')|| 'Email'}
              </span>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                      <input
                          className="input"
                          type="text"
                          value={email}
                          onChange={(e) => {
                              setEmail(e.target.value)
                              if(!e.target.value.trim()) setErrorEmail('auth.recoverPassword.enterEmail')
                              else if (!validateEmail(e.target.value)) setErrorEmail('auth.recoverPassword.invalidEmail')
                              else setErrorEmail(null)
                          }}
                          placeholder={t('auth.recoverPassword.emailPlaceholder') || 'Email'}
                          maxLength={6}
                          style={{ flex: 1 }}
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
                  {errorEmail && <div className="input-field-error">{t(errorEmail)}</div>}
              </label>

            <InputField
              label= {t('auth.recoverPassword.codePlaceholder') || 'Código de verificación'}
              type="text"
              value={code}
              onChange={(e) => {
                  setCode(e.target.value)
                  if(!e.target.value.trim()) setErrorCode('auth.recoverPassword.enterCode')
                  else setErrorCode(null)
              }}
              placeholder= {t('auth.recoverPassword.codePlaceholder') || 'Código de verificación'}
              disabled={loading || sendingCode}
              error={errorCode ? t(errorCode) : null }
            />

            <InputField
              label={t('auth.recoverPassword.newPassword') || 'Nueva contraseña'}
              value={newPassword}
              onChange={(e) => {
                  setNewPassword(e.target.value)
                  if (!e.target.value.trim()) setErrorPassword("auth.errors.passwordRequired")
                  else if (e.target.value.trim().length < 6) setErrorPassword('auth.recoverPassword.passwordTooShort')
                  else setErrorPassword(null)
                  }}
              placeholder={t('auth.recoverPassword.newPassword') || 'Nueva contraseña'}
              showPasswordToggle
              showPassword={showNewPassword}
              onTogglePassword={() => setShowNewPassword(!showNewPassword)}
              disabled={loading || sendingCode}
              error={errorPassword ? t(errorPassword) : null}
            />

            <InputField
              label={t('auth.recoverPassword.confirmPassword') || 'Confirmar contraseña'}
              value={confirmPassword}
              onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if(!e.target.value.trim()) setErrorConfirmPassword("auth.errors.confirmPasswordRequired")
                  else if (newPassword !== e.target.value) setErrorConfirmPassword('auth.recoverPassword.passwordsDoNotMatch')
                  else setErrorConfirmPassword(null)
              }}
              placeholder={t('auth.recoverPassword.confirmPassword') || 'Confirmar contraseña'}
              showPasswordToggle
              showPassword={showConfirmPassword}
              onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={loading || sendingCode}
              error={errorConfirmPassword ? t(errorConfirmPassword) : null}
            />

            <button
              type="submit"
              disabled={loading || sendingCode}
              className="auth-btn-primary"
            >
              {loading
                ? (t('auth.recoverPassword.changing') || 'Cambiando...')
                : t('auth.recoverPassword.confirmButton') || 'Confirmar'}
            </button>

            {message && <div className="message">{t(message)}</div>}
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

