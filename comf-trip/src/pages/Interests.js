// src/pages/Interests.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "./api";
import "../styles/interests.css";
import Sidebar from "../components/Sidebar";
import Hamburger from "../components/icons/Hamburger";
import UserIcon from "../components/icons/UserIcon";

// --- image loader: compatible Vite (import.meta.glob) y CRA/webpack (require.context)
const imagesMap = (() => {
  // Vite (import.meta.glob)
  try {
    // import.meta.glob with eager+as:'url' returns a map of path->url strings
    if (typeof import.meta !== "undefined" && import.meta.glob) {
      const modules = import.meta.glob('../assets/images/interests/*.png', { eager: true, as: 'url' });
      const map = {};
      for (const path in modules) {
        const filename = path.split('/').pop(); // e.g. 'cultura.png'
        const slug = filename.replace('.png', '');
        map[slug] = modules[path];
      }
      return map;
    }
  } catch (e) {
    // ignore — try webpack next
  }

  // Webpack / CRA: require.context
  try {
    // eslint-disable-next-line no-undef
    const req = require.context('../assets/images/interests', false, /\.png$/);
    const keys = req.keys();
    const map = {};
    keys.forEach((k) => {
      const filename = k.replace('./', ''); // 'cultura.png'
      const slug = filename.replace('.png', '');
      const resolved = req(k);
      // depending on setup req(k) may already be a url or an object with .default
      map[slug] = resolved?.default || resolved;
    });
    return map;
  } catch (e) {
    // no loader available
    return {};
  }
})();

// optional: data-url tiny placeholder (gray box) to avoid broken image look
const PLACEHOLDER =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160"><rect width="100%" height="100%" fill="#efefef"/><text x="50%" y="50%" alignment-baseline="middle" text-anchor="middle" fill="#bbb" font-size="14">Imagen</text></svg>`
  );

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
      <div className="home-header">
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
            // try slug first (recommended), fallback to id or title
            const slug = it.slug ?? String(it.id ?? it.title ?? "");
            const src = imagesMap[slug] || imagesMap[slug.toLowerCase?.()] || PLACEHOLDER;

            return (
              <button
                key={it.id}
                type="button"
                className={`interest-card ${isSel ? "selected" : ""}`}
                onClick={() => toggle(it.id)}
                aria-pressed={isSel}
              >
                <div className="interest-image" aria-hidden>
                  <img
                    src={src}
                    alt={it.title || slug}
                    onError={(e) => { e.currentTarget.src = PLACEHOLDER; }}
                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 6 }}
                  />
                </div>

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
