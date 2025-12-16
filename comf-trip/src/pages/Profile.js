// src/pages/Profile.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet} from "./api";
import "../styles/profile.css";
import { FaUser, FaEdit, FaLock, FaSignOutAlt } from "react-icons/fa";
import "../styles/header.css";
import {useAuth} from "../auth/AuthProvider";
import { useTranslation } from "../i18n";
import LoadingSpinner from "../components/LoadingSpinner";
import FilterSelect from "../components/FilterSelect";
import {formatDate} from "../utils/dateUtils";
import ConfirmDialog from "../components/ConfirmDialog";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, token, logout, setUser, hydrated } = useAuth();
  const [loading, setLoading] = useState(true);
  const { t, language, setLanguage } = useTranslation();

  const [profile, setProfile] = useState({
    id: null,
    name: "",
    email: "",
    phone: "",
    nationality: "",
    birthdate: "",
    photo: ""
  });
  const [logoutConfirm, setLogoutConfirm] = useState(false);

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
          birthdate: u.birthdate ? formatDate(u.birthdate) : "",
          photo: u.photo || ""
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

  function handleLogout() {
    setLogoutConfirm(true);
  }

  function confirmLogout() {
    logout();
    navigate("/login");
  }

  if (loading) {
    return <LoadingSpinner message={t('profile.loading')} fullScreen />
  }

  return (
    <div className="profile-root">

      <div className="profile-container">
        <div className="profile-card">
          <div className="profile-main">
            <div className="profile-left">
              <div className="profile-photo">
                {profile.photo ? <img src={profile.photo} alt={t('profile.photoAlt')} /> : <FaUser className="default-photo" />}
              </div>
              <h2 className="profile-name truncate-name" style={{maxWidth:"100%"}}>{profile.name || t('profile.noName')}</h2>
            </div>

            <div className="profile-right">
              <div className="profile-field">
                <span className="profile-field-label">{t('profile.email')}</span>
                <span className="profile-field-value">{profile.email || "—"}</span>
              </div>

              <div className="profile-field">
                <span className="profile-field-label">{t('profile.phone')}</span>
                <span className="profile-field-value">{profile.phone || "—"}</span>
              </div>

              <div className="profile-field">
                <span className="profile-field-label">{t('profile.birthdate')}</span>
                <span className="profile-field-value">{profile.birthdate || "—"}</span>
              </div>

              <div className="profile-field">
                <span className="profile-field-label">{t('profile.nationality')}</span>
                <span className="profile-field-value">{profile.nationality || "—"}</span>
              </div>

              <div className="profile-field">
                <span className="profile-field-label">{t('profile.language')}</span>
                <FilterSelect
                  value={language}
                  onChange={setLanguage}
                  options={[
                      { value: 'es', label: t('profile.spanish') },
                      { value: 'en', label: t('profile.english') },
                  ]}
                  isClearable={false}
                />
                <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>{t('profile.languageDescription')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-actions">
          {/* Row with Edit Profile and Change Password */}
          <div className="text-button-row">
            <button onClick={() => navigate("/edit-profile")} className="btn-text">
              <FaEdit /> {t('profile.editProfile')}
            </button>
            <button onClick={() => navigate("/change-password")} className="btn-text">
              <FaLock /> {t('profile.changePassword')}
            </button>
          </div>

          {/* Logout Button */}
          <button onClick={handleLogout} className="btn-primary">
            <FaSignOutAlt /> {t('profile.logout')}
          </button>
        </div>
      </div>

      {/* Confirmación de cierre de sesión */}
      <ConfirmDialog
        isOpen={logoutConfirm}
        onClose={() => setLogoutConfirm(false)}
        onConfirm={confirmLogout}
        title={t('profile.logoutTitle')}
        message={t('profile.logoutConfirm')}
        confirmText={t('profile.logout')}
        variant="primary"
      />
    </div>
  );
}


//version2 con posibles cambios
// src/pages/Profile.js
/* import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "./api";
import "../styles/profile.css";
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
              <h1 className="text-3xl font-bold mb-2">{profile.name || t('profile.noName')}</h1>
              <p className="text-muted-foreground mb-4">
                {profile.description || t('profile.addDescription')}
              </p>

              <div className="flex flex-wrap gap-4 justify-center md:justify-start text-sm text-muted-foreground">
                <button onClick={() => navigate("/edit-profile")} className="btn-edit">
                  <FaEdit /> {t('profile.editProfile')}
                </button>
                <button onClick={() => navigate("/change-password")} className="btn-change">
                  <FaLock /> {t('profile.changePassword')}
                </button>
                <button onClick={handleLogout} className="btn-logout">
                  <FaSignOutAlt /> {t('profile.logout')}
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