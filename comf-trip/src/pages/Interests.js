// src/pages/Interests.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "./api";
import "../styles/interests.css";
import Sidebar from "../components/Sidebar";
import Hamburger from "../components/icons/Hamburger";
import UserIcon from "../components/icons/UserIcon";

export default function InterestsPage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [interests, setInterests] = useState([]);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await apiGet("/users/interests");
        if (!mounted) return;
        setInterests(Array.isArray(res) ? res : []);
      } catch (err) {
        console.error("Error loading interests:", err);
        alert("No se pudieron cargar los intereses. Intente nuevamente.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  function toggle(id) {
    setSelected((s) => {
      const copy = new Set(s);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  }

  async function submitInterests() {
    // need user id + token in localStorage
    const stored = JSON.parse(localStorage.getItem("user") || "null");
    if (!stored || !stored.id) {
      alert("No authenticated user. Please log in.");
      navigate("/login");
      return;
    }
    const userId = stored.id;
    const interestIds = Array.from(selected);

    if (!interestIds.length) {
      const ok = window.confirm("No has seleccionado intereses. Deseas continuar?");
      if (!ok) return;
    }

    try {
      setLoading(true);
      await apiPost(`/users/${userId}/interests`, { interestIds });
      // Optionally update user in localStorage to include interests
      const newStored = { ...stored, interests: interestIds };
      localStorage.setItem("user", JSON.stringify(newStored));
      navigate("/home");
    } catch (err) {
      console.error("Error saving interests:", err);
      const errMsg = err?.message || err?.error || "Error al guardar intereses";
      alert(errMsg);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="interests-root">Cargando…</div>;
  }

  return (
    <div className="interests-root">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="trips-header">
        <button className="icon-btn icon-left" aria-label="menu" onClick={() => setMenuOpen(v => !v)}>
          <Hamburger />
        </button>
        <button className="icon-btn icon-right" aria-label="profile" onClick={() => navigate("/profile")}>
          <UserIcon />
        </button>
      </div>

      <main className="interests-container">
        <h2 className="interests-title">Seleccione sus intereses</h2>

        <div className="interests-grid">
          {interests.map((it) => {
            const isSel = selected.has(it.id);
            return (
              <button
                key={it.id}
                type="button"
                className={`interest-card ${isSel ? "selected" : ""}`}
                onClick={() => toggle(it.id)}
                aria-pressed={isSel}
              >
                <div className="interest-image" aria-hidden />
                <div className="interest-info">
                  <div className="interest-title">{it.title}</div>
                  <div className="interest-desc">{it.description}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="interests-actions">
          <button className="btn-primary" onClick={submitInterests} disabled={loading}>
            {loading ? "Guardando…" : "Comenzar con ComfTrip"}
          </button>
        </div>
      </main>
    </div>
  );
}
