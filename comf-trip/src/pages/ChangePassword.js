// src/pages/ChangePassword.jsx
import React, {useEffect, useState} from "react";
import { useNavigate } from "react-router-dom";
import { apiPut } from "./api";
import "../styles/changePassword.css";
import "../styles/header.css";
import { useTranslation } from "../i18n";
import { FaArrowLeft } from "react-icons/fa";
import ActionButton from "../components/ActionButton";
import InputField from "../components/forms/InputField";

export default function ChangePassword() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
    const [errorCurrentPassword, setErrorCurrentPassword]=useState(null)
    const [errorNewPassword, setErrorNewPassword]=useState(null)
    const [errorConfirmPassword, setErrorConfirmPassword]=useState(null)
    const [onCurrentPassword, setOnCurrentPassword]=useState(null)
    const [onNewPassword, setOnNewPassword]=useState(false)
    const [onConfirmPassword, setOnConfirmPassword]=useState(false)

    useEffect(() => {
        if (onCurrentPassword) {
            if (form.currentPassword.trim().length === 0) {
                setErrorCurrentPassword("auth.errors.passwordRequired")
            } else {
                setErrorCurrentPassword(null)
            }
        }
        if (onNewPassword) {
            if (form.newPassword.trim().length === 0) {
                setErrorNewPassword("auth.errors.passwordRequired")
            } else if (form.newPassword.trim().length < 6) {
                setErrorNewPassword("auth.errors.passwordMinLength")
            } else {
                setErrorNewPassword(null)
            }
        }
        if (onConfirmPassword) {
            if (form.password !== form.confirmPassword) {
                if (form.confirmPassword.trim().length === 0) {
                    setErrorConfirmPassword("auth.errors.confirmPasswordRequired")
                } else {
                    setErrorConfirmPassword("changePassword.passwordsDontMatch")
                }
            } else {
                setErrorConfirmPassword(null)
            }
        }
    }, [form]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
      if(name==="currentPassword"){
          setOnCurrentPassword(true)
      }
      if(name==="newPassword"){
          setOnNewPassword(true)
      }
      if(name==="confirmPassword"){
          setOnConfirmPassword(true)
      }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const stored = JSON.parse(localStorage.getItem("user") || "null") || {};
    if (!stored || !stored.id) {
      alert(t('changePassword.userNotIdentified'));
      navigate("/login");
      return;
    }

    setErrorCurrentPassword(null)
      setErrorNewPassword(null);
      setErrorConfirmPassword(null)
    let invalid=false
      if (form.currentPassword.trim().length === 0) {
          setErrorCurrentPassword("auth.errors.passwordRequired")
          invalid=true
      }
      if (form.newPassword.trim().length === 0) {
          setErrorNewPassword("auth.errors.passwordRequired")
          invalid=true
      } else if (form.newPassword.trim().length < 6) {
          setErrorNewPassword("auth.errors.passwordMinLength")
          invalid=true
      }
      if (form.newPassword !== form.confirmPassword) {
          if (form.confirmPassword.trim().length === 0) {
              setErrorConfirmPassword("auth.errors.confirmPasswordRequired")
          } else {
              setErrorConfirmPassword("changePassword.passwordsDontMatch")
          }
          invalid=true
      }

      if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
          alert(t('changePassword.fillAllFields'));
          return;
      }
      if (form.newPassword !== form.confirmPassword) {
          alert(t('changePassword.passwordsDontMatch'));
          return;
      }
      if(invalid) return;

      setLoading(true);
    try {
      // backend expects { oldPassword, newPassword }
      await apiPut(`/users/${stored.id}/password`, {
        oldPassword: form.currentPassword,
        newPassword: form.newPassword
      });

      // success
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      alert(t('changePassword.success'));
      navigate("/profile");
    } catch (err) {
      // err may be object or string — normalize message
      let message = t('changePassword.error');
      if (err && typeof err === "object") {
        // If your backend returns { message: "..." } or { error: "..." }
        message = err.message || err.error || JSON.stringify(err);
      } else if (typeof err === "string") {
        message = err;
      }
      // specific handling for auth errors
      if (message.toLowerCase().includes("no token") ||
          message.toLowerCase().includes("token inválido") ||
          message.toLowerCase().includes("no autorizado") ||
          message.toLowerCase().includes("401") ||
          message.toLowerCase().includes("403")) {
        alert(t('changePassword.invalidSession'));
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/login");
        return;
      }

      alert(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="change-root">

      <main className="change-container">

        <h1 className="change-title">{t('changePassword.title')}</h1>

        <form className="change-form" onSubmit={handleSubmit}>

          <InputField
            label={t('changePassword.currentPassword')}
            name="currentPassword"
            value={form.currentPassword}
            onChange={handleChange}
            placeholder={t('changePassword.currentPassword')}
            showPasswordToggle
            showPassword={showCurrentPassword}
            onTogglePassword={() => setShowCurrentPassword(!showCurrentPassword)}
            disabled={loading}
            containerClassName="change-field"
            error={errorCurrentPassword ? t(errorCurrentPassword) : null }
          />

          <InputField
            label={t('changePassword.newPassword')}
            name="newPassword"
            value={form.newPassword}
            onChange={handleChange}
            placeholder={t('changePassword.newPassword')}
            showPasswordToggle
            showPassword={showNewPassword}
            onTogglePassword={() => setShowNewPassword(!showNewPassword)}
            disabled={loading}
            containerClassName="change-field"
            error={errorNewPassword ? t(errorNewPassword) : null}
          />

          <InputField
            label={t('changePassword.confirmPassword')}
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            placeholder={t('changePassword.confirmPassword')}
            showPasswordToggle
            showPassword={showConfirmPassword}
            onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
            disabled={loading}
            containerClassName="change-field"
            error={errorConfirmPassword ? t(errorConfirmPassword) : null}
          />

          <div className="form-actions">
            <ActionButton type="submit" variant="edit" disabled={loading}>
              {loading ? t('changePassword.changing') : t('changePassword.change')}
            </ActionButton>
          </div>
        </form>
      </main>
    </div>
  );
}
