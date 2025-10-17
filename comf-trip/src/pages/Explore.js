// src/pages/Explore.js
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import "../styles/explore.css";
import { apiGet } from "./api";
import OptimizedImage from "../components/OptimizedImage";

const safeParseImages = (im) => {
  if (!im) return [];
  if (Array.isArray(im)) return im;
  if (typeof im === "string") {
    try {
      const parsed = JSON.parse(im);
      if (Array.isArray(parsed)) return parsed;
      return [parsed];
    } catch (e) {
      return [im];
    }
  }
  return [];
};

// mapa slug -> icono (emoji por defecto, podés poner SVG o clases si querés)
const categoryIcons = {
  cultura: "🎭",
  naturaleza: "🌲",
  gastronomia: "🍽️",
  compras: "🛍️",
  fiestas: "🎉",
  deportes: "⚽",
  relax: "🧘",
  familia: "👨‍👩‍👧‍👦",
};

function sortByRelevanceDesc(arr) {
  if (!Array.isArray(arr)) return [];
  return [...arr].sort((a, b) => (Number(b.relevancia || 0) - Number(a.relevancia || 0)));
}

export default function Explore() {
  const navigate = useNavigate();

  // server-driven
  const [categories, setCategories] = useState([]); // from /api/interests
  const [popularLocations, setPopularLocations] = useState([]);
  const [locationsFiltered, setLocationsFiltered] = useState([]);

  // ui & state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState("todo");

  // compact filters with selects
  const [selectedDuration, setSelectedDuration] = useState("");
  const [selectedBudget, setSelectedBudget] = useState("");
  const [selectedSeason, setSelectedSeason] = useState("");

  // modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedExperience, setSelectedExperience] = useState(null);

    const scrollRoot = typeof document !== "undefined"
        ? document.querySelector(".explorar-main")
        : null;
  // initial load: categories + popular locations
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const cats = await apiGet("/interests");
        const locs = await apiGet("/locations?limit=200");

        if (!mounted) return;
        setCategories(Array.isArray(cats) ? cats : []);

        // ensure sorting by relevancia DESC
        const sorted = sortByRelevanceDesc(Array.isArray(locs) ? locs : []);
        setPopularLocations(sorted.slice(0, 12));
        setLocationsFiltered(sorted.slice(0, 50));
      } catch (err) {
        console.error("Explore load error:", err);
        setError("No se pudo cargar la página. Intente nuevamente.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, []);

  // when category changes, fetch filtered locations
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (selectedCategorySlug === "todo") {
          const locs = await apiGet("/locations?limit=200");
          if (!mounted) return;
          const sorted = sortByRelevanceDesc(Array.isArray(locs) ? locs : []);
          setLocationsFiltered(sorted.slice(0, 50));
        } else {
          // backend supports ?interest=slug (if backend handles slug) — still defensively sort on client
          const locs = await apiGet(`/locations?interest=${encodeURIComponent(selectedCategorySlug)}&limit=200`);
          if (!mounted) return;
          const sorted = sortByRelevanceDesc(Array.isArray(locs) ? locs : []);
          setLocationsFiltered(sorted);
        }
      } catch (err) {
        console.error("Error fetching filtered locations:", err);
        setError("No se pudieron cargar las localidades filtradas.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => (mounted = false);
  }, [selectedCategorySlug]);

  const mapToExperiences = (locs) => {
    if (!Array.isArray(locs)) return [];
    return locs.map((loc) => {
      const imgs = safeParseImages(loc.imagenes);
      return {
        id: loc.id,
        title: loc.titulo || `Lugar #${loc.id}`,
        description: loc.descripcion ? (loc.descripcion.length > 150 ? loc.descripcion.slice(0, 150) + "…" : loc.descripcion) : "",
        category: loc.fk_interest,
        image: imgs.length ? imgs[0] : null,
        raw: loc,
      };
    });
  };

  const popularExperiences = useMemo(() => mapToExperiences(popularLocations), [popularLocations]);
  const filteredExperiences = useMemo(() => mapToExperiences(locationsFiltered), [locationsFiltered]);

  const onCategoryClick = (slug) => {
    setSelectedCategorySlug(slug);
  };

  const handleExperienceClick = (experience) => {
    setSelectedExperience(experience);
    setShowDetailModal(true);
  };

  const handleCreateTrip = () => {
    setShowDetailModal(false);
    navigate("/add-trip", { state: { destination: selectedExperience?.title ?? "" } });
  };

  const handleShare = () => {
    if (!selectedExperience) return;
    if (navigator.share) {
      navigator.share({
        title: selectedExperience.title,
        text: selectedExperience.description,
        url: window.location.href,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Enlace copiado al portapapeles");
    }
  };

  const clearFilters = () => {
    setSelectedCategorySlug("todo");
    setSelectedDuration("");
    setSelectedBudget("");
    setSelectedSeason("");
  };

  const removeActiveFilter = (type) => {
    if (type === "duration") setSelectedDuration("");
    if (type === "budget") setSelectedBudget("");
    if (type === "season") setSelectedSeason("");
  };

  if (loading) {
    return (
      <div className="explorar-page">
        <Header />
        <main className="explorar-main">
          <div className="explorar-container">
            <h1 className="explorar-title">Explorar por categorías</h1>
            <div>Cargando…</div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="explorar-page">
        <Header />
        <main className="explorar-main">
          <div className="explorar-container">
            <h1 className="explorar-title">Explorar por categorías</h1>
            <div className="error">{error}</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="explorar-page">
      <Header />
      <main className="explorar-main">
        <div className="explorar-container">
          <h1 className="explorar-title">Explorar por categorías</h1>

          {/* categories */}
          <div className="categories-section">
            <div className="categories-grid">
              <div
                className={`category-card ${selectedCategorySlug === "todo" ? "active" : ""}`}
                onClick={() => onCategoryClick("todo")}
              >
                <div className="category-icon">🌍</div>
                <div className="category-name">Todo</div>
              </div>

              {categories.map((cat) => {
                const icon = categoryIcons[cat.slug] || "📍";
                return (
                  <div
                    key={cat.slug}
                    className={`category-card ${selectedCategorySlug === cat.slug ? "active" : ""}`}
                    onClick={() => onCategoryClick(cat.slug)}
                  >
                    <div className="category-icon">{icon}</div>
                    <div className="category-name">{cat.title}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* filters compact */}
          <div className="filters-section compact">
            <div className="filters-row">
              <div className="filter-field">
                <label>Duración</label>
                <select value={selectedDuration} onChange={(e) => setSelectedDuration(e.target.value)} className="filter-select">
                  <option value="">Cualquiera</option>
                  <option value="corto">Corto (1-3 días)</option>
                  <option value="medio">Medio (4-7 días)</option>
                  <option value="largo">Largo (8+ días)</option>
                  <option value="fin_semana">Fin de semana</option>
                </select>
              </div>

              <div className="filter-field">
                <label>Presupuesto</label>
                <select value={selectedBudget} onChange={(e) => setSelectedBudget(e.target.value)} className="filter-select">
                  <option value="">Cualquiera</option>
                  <option value="economico">Económico</option>
                  <option value="moderado">Moderado</option>
                  <option value="lujo">Lujo</option>
                </select>
              </div>

              <div className="filter-field">
                <label>Época</label>
                <select value={selectedSeason} onChange={(e) => setSelectedSeason(e.target.value)} className="filter-select">
                  <option value="">Cualquiera</option>
                  <option value="primavera">Primavera</option>
                  <option value="verano">Verano</option>
                  <option value="otono">Otoño</option>
                  <option value="invierno">Invierno</option>
                </select>
              </div>

              <div className="filter-actions">
                <button className="btn-clear" onClick={clearFilters}>Borrar filtros</button>
                <div className="hint">Nota: filtros UI (pueden conectarse al backend)</div>
              </div>
            </div>

            {/* chips active filters */}
            <div className="active-chips">
              {selectedDuration && (
                <div className="filter-chip">
                  Duración: {selectedDuration}
                  <button className="chip-x" onClick={() => removeActiveFilter("duration")}>✕</button>
                </div>
              )}
              {selectedBudget && (
                <div className="filter-chip">
                  Presupuesto: {selectedBudget}
                  <button className="chip-x" onClick={() => removeActiveFilter("budget")}>✕</button>
                </div>
              )}
              {selectedSeason && (
                <div className="filter-chip">
                  Época: {selectedSeason}
                  <button className="chip-x" onClick={() => removeActiveFilter("season")}>✕</button>
                </div>
              )}
            </div>
          </div>

          {/* filtered results first */}
          <div className="experiences-section">
            <div className="section-header">
              <h2>{selectedCategorySlug === "todo" ? "Resultados" : `Resultados — ${selectedCategorySlug}`}</h2>
              <div className="small-muted">{filteredExperiences.length} resultados</div>
            </div>

              <div className="experiences-grid">
                  {filteredExperiences.length === 0 ? (
                      <div className="muted">No se encontraron lugares para esta categoría.</div>
                  ) : (
                      filteredExperiences.map((exp, idx) => (
                          <div key={exp.id} className="experience-card" onClick={() => handleExperienceClick(exp)}>
                              <div className="card-image">
                                  {exp.image ? (
                                      <OptimizedImage
                                          src={exp.image}
                                          alt={exp.title}
                                          width={400}
                                          height={260}
                                          scrollRoot={scrollRoot}
                                          priority={idx < 6}  // primeras rápido
                                      />
                                  ) : (
                                      <div className="no-image">No image</div>
                                  )}
                              </div>
                              <div className="card-content">
                                  <h3 className="card-title">{exp.title}</h3>
                                  <p className="card-description">{exp.description}</p>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>

          {/* popular below */}
          <div className="experiences-section">
            <div className="section-header">
              <h2>Populares</h2>
            </div>

              <div className="experiences-grid">
                  {popularExperiences.map((exp, idx) => (
                      <div key={exp.id} className="experience-card" onClick={() => handleExperienceClick(exp)}>
                          <div className="card-image">
                              {exp.image ? (
                                  <OptimizedImage
                                      src={exp.image}
                                      alt={exp.title}
                                      width={400}
                                      height={260}
                                      scrollRoot={scrollRoot}
                                      priority={idx < 6}  // primeras rápido
                                  />
                              ) : (
                                  <div className="no-image">No image</div>
                              )}
                          </div>
                          <div className="card-content">
                              <h3 className="card-title">{exp.title}</h3>
                              <p className="card-description">{exp.description}</p>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
        </div>
      </main>

      {/* modal */}
      {showDetailModal && selectedExperience && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowDetailModal(false)}>×</button>
            <div className="modal-image">{selectedExperience.image ? <img src={selectedExperience.image} alt={selectedExperience.title} /> : null}</div>
            <div className="modal-details">
              <h2>{selectedExperience.title}</h2>
              <p className="modal-description">{selectedExperience.description}</p>
              <div className="modal-actions">
                <button className="btn-create" onClick={handleCreateTrip}>Crear plan de viaje</button>
                <button className="btn-share" onClick={handleShare}>Compartir</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
