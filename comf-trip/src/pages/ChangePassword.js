// src/pages/ChangePassword.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPut } from "./api";
import "../styles/changePassword.css";
import "../styles/header.css";
import { useTranslation } from "../i18n";
import { FaArrowLeft } from "react-icons/fa";

export default function ChangePassword() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const stored = JSON.parse(localStorage.getItem("user") || "null") || {};
    if (!stored || !stored.id) {
      alert(t('changePassword.userNotIdentified'));
      navigate("/login");
      return;
    }

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      alert(t('changePassword.fillAllFields'));
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      alert(t('changePassword.passwordsDontMatch'));
      return;
    }

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

          <label className="change-field">
            <div className="change-field-label">{t('changePassword.currentPassword')}</div>
            <input
              type="password"
              name="currentPassword"
              className={"input"}
              value={form.currentPassword}
              onChange={handleChange}
              placeholder={t('changePassword.currentPassword')}
              required
              disabled={loading}
            />
          </label>

          <label className="change-field">
            <div className="change-field-label">{t('changePassword.newPassword')}</div>
            <input
              type="password"
              name="newPassword"
              value={form.newPassword}
              className={"input"}
              onChange={handleChange}
              placeholder={t('changePassword.newPassword')}
              required
              disabled={loading}
            />
          </label>

          <label className="change-field">
            <div className="change-field-label">{t('changePassword.confirmPassword')}</div>
            <input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              className={"input"}
              onChange={handleChange}
              placeholder={t('changePassword.confirmPassword')}
              required
              disabled={loading}
            />
          </label>

          <div className="form-actions">
            <button type="submit" className="edit-btn-primary" disabled={loading}>
              {loading ? t('changePassword.changing') : t('changePassword.change')}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
