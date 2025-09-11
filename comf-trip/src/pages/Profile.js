// src/pages/Profile.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPut } from "./api";
import "../styles/profile.css";
import UserIcon from "../components/icons/UserIcon";
import Sidebar from "../components/Sidebar";
import Hamburger from "../components/icons/Hamburger";

export default function ProfilePage() {
  const navigate = useNavigate();
  //const [menuOpen, setMenuOpen] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    nationality: "",
    birthdate: ""
  });

  useEffect(() => {
    const stored = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (!stored || !token) {
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
        if (err && (err.message === "No token" || err.message === "Token inválido" || err.status === 401 || err.status === 403)) {
          navigate("/login");
        } else {
          // optional: show error UI
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
      const updatedUser = res.user || { ...payload, id: profile.id };

      setProfile(p => ({
        ...p,
        name: updatedUser.name || payload.name,
        email: updatedUser.email || payload.email,
        phone: updatedUser.phone || payload.phone,
        nationality: updatedUser.nationality || payload.nationality,
        birthdate: updatedUser.birthdate || payload.birthdate
      }));

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
      <Sidebar open={menuAbierto} onClose={() => setMenuAbierto(false)} />

      <div className="profile-header">
        <button
            className="icon-btn icon-left"
            aria-label="menu"
            onClick={() => setMenuAbierto(!menuAbierto)}
        >
          <Hamburger />
        </button>

        <button className="icon-btn icon-right" aria-label="profile" onClick={() => navigate("/profile")}>
          <UserIcon />
        </button>
      </div>

      <div className="profile-card">
        <div className="profile-main">
          <div className="profile-left">
            <div className="profile-photo">
              {profile.photo ? <img src={profile.photo} alt="Foto perfil" /> : <UserIcon className="default-photo" />}
            </div>
            <h2 className="profile-name">{profile.name || "Sin nombre"}</h2>
          </div>

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
              Editar datos
            </button>
          )}

          <button onClick={() => navigate("/change-password")} className="btn-change">
            Cambiar contraseña
          </button>

          <button onClick={handleLogout} className="btn-logout">Cerrar sesión</button>
        </div>
      </div>
    </div>
  );
}
