// src/pages/Profile.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPut } from "./api"; // your api.js exports
import "../styles/profile.css";
import UserIcon from "../components/icons/UserIcon";
import Sidebar from "../components/Sidebar";
import Hamburger from "../components/icons/Hamburger";

export default function ProfilePage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // profile data in backend shape mapped to UI-friendly keys
  const [profile, setProfile] = useState({
    id: null,
    name: "",
    email: "",
    phone: "",
    nationality: "",
    birthdate: "",
    photo: ""
  });

  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // form states for editing
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    nationality: "",
    birthdate: ""
  });

  // password form
  const [pwdForm, setPwdForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });

  useEffect(() => {
    const stored = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (!stored || !token) {
      // not logged in — send to error page or login
      // choose where you want to redirect; here we go to /login
      navigate("/login");
      return;
    }

    const parsed = JSON.parse(stored);
    const id = parsed.id;
    if (!id) {
      navigate("/login");
      return;
    }

    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await apiGet(`/users/${id}`);
        // expected { user: { id, name, email, phone, nationality, birthdate, ... }, interests: [...] }
        const u = res.user || {};
        if (!mounted) return;

        setProfile({
          id: u.id,
          name: u.name || "",
          email: u.email || "",
          phone: u.phone || "",
          nationality: u.nationality || "",
          birthdate: u.birthdate ? u.birthdate.split("T")[0] : "",
          photo: u.photo || ""
        });

        setForm({
          name: u.name || "",
          email: u.email || "",
          phone: u.phone || "",
          nationality: u.nationality || "",
          birthdate: u.birthdate ? u.birthdate.split("T")[0] : ""
        });
      } catch (err) {
        console.error("Error fetching profile:", err);
        // if 401/403 -> redirect to login
        if (err && (err.message === "No token" || err.message === "Token inválido" || err.status === 401 || err.status === 403)) {
          navigate("/login");
        } else {
          // optionally show an error page / notification
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [navigate]);

  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  async function saveProfile(e) {
    e?.preventDefault?.();
    if (!profile.id) return alert("No user id");
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        nationality: form.nationality,
        birthdate: form.birthdate || null
      };

      const res = await apiPut(`/users/${profile.id}`, payload);
      // backend should return updated user (recommended). If it returns { message } adjust accordingly.
      const updatedUser = res.user || { ...payload, id: profile.id };

      // update local state
      setProfile(p => ({
        ...p,
        name: updatedUser.name || payload.name,
        email: updatedUser.email || payload.email,
        phone: updatedUser.phone || payload.phone,
        nationality: updatedUser.nationality || payload.nationality,
        birthdate: updatedUser.birthdate || payload.birthdate
      }));

      // update stored local user (so other pages also reflect updates)
      const stored = JSON.parse(localStorage.getItem("user") || "null") || {};
      const newStored = {
        ...stored,
        id: updatedUser.id || stored.id,
        name: updatedUser.name || payload.name,
        email: updatedUser.email || payload.email,
        phone: updatedUser.phone || payload.phone,
        nationality: updatedUser.nationality || payload.nationality,
        birthdate: updatedUser.birthdate || payload.birthdate
      };
      localStorage.setItem("user", JSON.stringify(newStored));

      setEditing(false);
      alert("Perfil actualizado");
    } catch (err) {
      console.error("Error saving profile", err);
      const message = err?.message || err?.error || JSON.stringify(err);
      alert("Error actualizando perfil: " + message);
    }
  }

  function handlePwdChangeInput(e) {
    const { name, value } = e.target;
    setPwdForm(f => ({ ...f, [name]: value }));
  }

  async function submitPasswordChange(e) {
    e?.preventDefault?.();
    if (!profile.id) return alert("No user id");
    if (!pwdForm.currentPassword || !pwdForm.newPassword) return alert("Complete las contraseñas");
    if (pwdForm.newPassword !== pwdForm.confirmPassword) return alert("Las contraseñas nuevas no coinciden");

    try {
      // expects backend endpoint PUT /users/:id/password accepting { currentPassword, newPassword }
      await apiPut(`/users/${profile.id}/password`, {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword
      });

      setPwdForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setChangingPassword(false);
      alert("Contraseña modificada");
    } catch (err) {
      console.error("Error changing password", err);
      const message = err?.message || err?.error || JSON.stringify(err);
      alert("Error cambiando contraseña: " + message);
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  }

  if (loading) {
    return <div className="profile-root">Cargando perfil…</div>;
  }

  return (
    <div className="profile-root">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="trips-header">
        <button className="icon-btn icon-left" aria-label="menu" onClick={() => setMenuOpen(v => !v)}>
          <Hamburger />
        </button>

        <button className="icon-btn icon-right" aria-label="profile" onClick={() => {/* already here */}}>
          <UserIcon />
        </button>
      </div>

      <div className="profile-card">
        <div className="profile-main">

          {/* left column */}
          <div className="profile-left">
            <div className="profile-photo">
              {profile.photo ? <img src={profile.photo} alt="Foto perfil" /> : <UserIcon className="default-photo" />}
            </div>
            <h2 className="profile-name">{profile.name || "Sin nombre"}</h2>
          </div>

          {/* right column */}
          <div className="profile-right">
            {!editing ? (
              <>
                <div className="profile-field"><strong>Email</strong><div>{profile.email || "—"}</div></div>
                <div className="profile-field"><strong>Teléfono</strong><div>{profile.phone || "—"}</div></div>
                <div className="profile-field"><strong>Fecha de nacimiento</strong><div>{profile.birthdate || "—"}</div></div>
                <div className="profile-field"><strong>Nacionalidad</strong><div>{profile.nationality || "—"}</div></div>
              </>
            ) : (
              <form className="profile-edit-form" onSubmit={saveProfile}>
                <label>
                  <div className="field-label">Nombre</div>
                  <input name="name" value={form.name} onChange={handleFormChange} />
                </label>

                <label>
                  <div className="field-label">Email</div>
                  <input name="email" value={form.email} onChange={handleFormChange} type="email" />
                </label>

                <label>
                  <div className="field-label">Teléfono</div>
                  <input name="phone" value={form.phone} onChange={handleFormChange} />
                </label>

                <label>
                  <div className="field-label">Fecha de nacimiento</div>
                  <input name="birthdate" value={form.birthdate} onChange={handleFormChange} type="date" />
                </label>

                <label>
                  <div className="field-label">Nacionalidad</div>
                  <input name="nationality" value={form.nationality} onChange={handleFormChange} />
                </label>

                <div className="profile-edit-actions">
                  <button type="submit" className="btn-primary">Guardar</button>
                  <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>Cancelar</button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="profile-actions">
          {!editing && (
            <button onClick={() => setEditing(true)} className="btn-edit">
              {/* pencil icon small */}
              Editar datos
            </button>
          )}

          {!changingPassword && (
            <button onClick={() => setChangingPassword(true)} className="btn-change">
              Cambiar contraseña
            </button>
          )}

          {changingPassword && (
            <form className="password-change-form" onSubmit={submitPasswordChange}>
              <label>
                <div className="field-label">Contraseña actual</div>
                <input name="currentPassword" value={pwdForm.currentPassword} onChange={handlePwdChangeInput} type="password" />
              </label>
              <label>
                <div className="field-label">Nueva contraseña</div>
                <input name="newPassword" value={pwdForm.newPassword} onChange={handlePwdChangeInput} type="password" />
              </label>
              <label>
                <div className="field-label">Confirmar nueva</div>
                <input name="confirmPassword" value={pwdForm.confirmPassword} onChange={handlePwdChangeInput} type="password" />
              </label>
              <div className="profile-edit-actions">
                <button type="submit" className="btn-primary">Guardar contraseña</button>
                <button type="button" className="btn-secondary" onClick={() => { setChangingPassword(false); setPwdForm({ currentPassword: "", newPassword: "", confirmPassword: "" }); }}>Cancelar</button>
              </div>
            </form>
          )}

          <button onClick={handleLogout} className="btn-logout">Cerrar sesión</button>
        </div>
      </div>
    </div>
  );
}
