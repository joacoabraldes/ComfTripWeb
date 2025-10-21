// src/pages/Profile.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet} from "./api";
import "../styles/profile.css";
import { FaUser } from "react-icons/fa";
import Header from "../components/Header";
import "../styles/header.css";
import {useAuth} from "../auth/AuthProvider";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, token, logout, setUser, hydrated } = useAuth();
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

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    nationality: "",
    birthdate: ""
  });

  useEffect(() => {
    if(!hydrated) return;
    if (!token || !user) {
      navigate("/login");
      return;
    }

    const id = user.id;
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
  }, [user, token, hydrated, navigate, setUser]);

  function handleFormChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  }

  function handleLogout() {
    logout();
    navigate("/login");

  }

  if (loading) {
    return <div className="profile-root" style={{fontSize:25}}>Cargando perfil…</div>;
  }

  return (
    <div className="profile-root">
      <Header/>

      <div className="profile-card">
        <div className="profile-main">
          <div className="profile-left">
            <div className="profile-photo">
              {profile.photo ? <img src={profile.photo} alt="Foto perfil" /> : <FaUser className="default-photo" />}
            </div>
            <h2 className="profile-name">{profile.name || "Sin nombre"}</h2>
          </div>

          <div className="profile-right">

                <>
                  <div className="profile-field">
                    <span className="profile-field-label">Mail</span>
                    <span className="profile-field-value">{profile.email || "—"}</span>
                  </div>

                  <div className="profile-field">
                    <span className="profile-field-label">Numero de telefono</span>
                    <span className="profile-field-value">{profile.phone || "—"}</span>
                  </div>

                  <div className="profile-field">
                    <span className="profile-field-label">Fecha de Nacimiento</span>
                    <span className="profile-field-value">{profile.birthdate || "—"}</span>
                  </div>

                  <div className="profile-field">
                    <span className="profile-field-label">Nacionalidad</span>
                    <span className="profile-field-value">{profile.nationality || "—"}</span>
                  </div>
                </>

          </div>
        </div>

        <div className="profile-actions">

            <button onClick={() => navigate("/edit-profile")} className="btn-edit">
              <svg width="30" height="30" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.9166 8.33336H8.33329C7.22822 8.33336 6.16842 8.77235 5.38701 9.55375C4.60561 10.3351 4.16663 11.395 4.16663 12.5V41.6667C4.16663 42.7718 4.60561 43.8316 5.38701 44.613C6.16842 45.3944 7.22822 45.8334 8.33329 45.8334H37.5C38.605 45.8334 39.6648 45.3944 40.4462 44.613C41.2276 43.8316 41.6666 42.7718 41.6666 41.6667V27.0834M38.5416 5.20836C39.3704 4.37956 40.4945 3.91394 41.6666 3.91394C42.8387 3.91394 43.9628 4.37956 44.7916 5.20836C45.6204 6.03716 46.086 7.16126 46.086 8.33336C46.086 9.50546 45.6204 10.6296 44.7916 11.4584L25 31.25L16.6666 33.3334L18.75 25L38.5416 5.20836Z" stroke="#FF3951" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg> Editar datos
            </button>


          <button onClick={() => navigate("/change-password")} className="btn-change">
            <svg width="30" height="30" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14.5833 22.9167V14.5834C14.5833 11.8207 15.6808 9.17116 17.6343 7.21766C19.5878 5.26415 22.2373 4.16669 25 4.16669C27.7627 4.16669 30.4122 5.26415 32.3657 7.21766C34.3192 9.17116 35.4167 11.8207 35.4167 14.5834V22.9167M10.4167 22.9167H39.5833C41.8845 22.9167 43.75 24.7822 43.75 27.0834V41.6667C43.75 43.9679 41.8845 45.8334 39.5833 45.8334H10.4167C8.11548 45.8334 6.25 43.9679 6.25 41.6667V27.0834C6.25 24.7822 8.11548 22.9167 10.4167 22.9167Z" stroke="#FF3951" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg> Cambiar contraseña
          </button>

          <button onClick={handleLogout} className="btn-logout">
            <svg width="30" height="30" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.75 43.75H10.4167C9.3116 43.75 8.25179 43.311 7.47039 42.5296C6.68899 41.7482 6.25 40.6884 6.25 39.5833V10.4167C6.25 9.3116 6.68899 8.25179 7.47039 7.47039C8.25179 6.68899 9.3116 6.25 10.4167 6.25H18.75M33.3333 35.4167L43.75 25M43.75 25L33.3333 14.5833M43.75 25H18.75" stroke="black" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg> Cerrar sesión</button>
        </div>
      </div>
    </div>
  );
}


//version2 con posibles cambios
// src/pages/Profile.js
/* import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "./api";
import "../styles/profile.css";
import Header from "../components/Header";
import { useAuth } from "../auth/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, token, logout, hydrated } = useAuth();
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState({
    id: null,
    name: "",
    photo: "",
    description: ""
  });

  useEffect(() => {
    if (!hydrated) return;
    if (!token || !user) {
      navigate("/login");
      return;
    }

    const id = user.id;
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
          photo: u.photo || "",
          description: u.description || ""
        });
      } catch (err) {
        console.error("Error fetching profile:", err);
        if (err && (err.message === "No token" || err.message === "Token inválido" || err.status === 401 || err.status === 403)) {
          navigate("/login");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user, token, hydrated, navigate]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  if (loading) {
    return <div className="profile-root loading">Cargando perfil…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Profile Header *//*}
        <div className="profile-header card">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <Avatar className="h-24 w-24 border-4 border-primary">
              {profile.photo ? (
                <AvatarImage src={profile.photo} />
              ) : (
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {profile.name ? profile.name[0] : "U"}
                </AvatarFallback>
              )}
            </Avatar>

            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-bold mb-2">{profile.name || "Sin nombre"}</h1>
              <p className="text-muted-foreground mb-4">
                {profile.description || "Agregá una descripción en editar perfil."}
              </p>

              <div className="flex flex-wrap gap-4 justify-center md:justify-start text-sm text-muted-foreground">
                <button onClick={() => navigate("/edit-profile")} className="btn-edit">
                  ✏️ Editar datos
                </button>
                <button onClick={() => navigate("/change-password")} className="btn-change">
                  🔑 Cambiar contraseña
                </button>
                <button onClick={handleLogout} className="btn-logout">
                  🚪 Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
*/