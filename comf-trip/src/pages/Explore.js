// src/pages/Explore.js
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import "../styles/explore.css";
import { apiGet } from "./api";
import OptimizedImage from "../components/OptimizedImage";

/**
 * Normalize many image shapes into an array of URL strings
 * - accepts array of strings, array of objects { url }, JSON-stringified array, comma lists, single strings, object with .url or .urls
 */
const safeParseImages = (im) => {
  if (!im) return [];
  if (Array.isArray(im)) return im.map((it) => (typeof it === "object" && it !== null && it.url ? it.url : it));
  if (typeof im === "string") {
    try {
      const parsed = JSON.parse(im);
      if (Array.isArray(parsed)) return parsed.map((it) => (typeof it === "object" && it !== null && it.url ? it.url : it));
      // parsed is a primitive
      return [parsed];
    } catch (e) {
      // fallback: comma separated list or single url
      if (im.includes(",")) {
        return im.split(",").map((s) => s.trim());
      }
      return [im];
    }
  }
  if (typeof im === "object" && im !== null) {
    if (Array.isArray(im.urls)) return im.urls;
    if (im.url) return [im.url];
  }
  return [];
};

// map slug -> emoji icon
const categoryIcons = {
  cultura: "🎭",
  naturaleza: "🌲",
  gastronomia: "🍽️",
  compras: "🛍️",
  fiestas: "🎉",
  deportes: "⚽",
  relax: "🧘",
  familia: "👨‍👩👧‍👦",
};

function sortByRelevanceDesc(arr) {
  if (!Array.isArray(arr)) return [];
  const getRel = (x) => {
    const v = x?.relevance ?? x?.relevancia ?? 0;
    return Number(v) || 0;
  };
  return [...arr].sort((a, b) => getRel(b) - getRel(a));
}

/**
 * Pick the BEST thumbnail candidate from an array of image URLs.
 * Rules (in order):
 *  - prefer Wikimedia-style /thumb/ URLs (they are already sized)
 *  - prefer URLs containing '/<N>px-' (small derivative)
 *  - prefer second element (many APIs return [full, thumb])
 *  - fallback to first
 */
const pickBestImage = (imgs = []) => {
  if (!Array.isArray(imgs) || imgs.length === 0) return null;
  // ensure strings
  const urls = imgs.filter(Boolean).map((u) => (typeof u === "string" ? u : String(u)));

  // prefer explicit '/thumb/' pattern (common in Wikimedia)
  const thumb = urls.find((u) => u.includes("/thumb/"));
  if (thumb) return thumb;

  // prefer something with '/<N>px-' (e.g. .../330px-Filename.jpg)
  const smallPx = urls.find((u) => /\/\d+px-/.test(u));
  if (smallPx) return smallPx;

  // many APIs: [full, thumb] -> pick second if exists
  if (urls[1]) return urls[1];

  // fallback to first item
  return urls[0] || null;
};

/**
 * Given a Wikimedia-style thumb URL, produce a srcset for multiple widths.
 * Example thumb URL:
 * https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Filename.jpg/330px-Filename.jpg
 *
 * This function will replace '/330px-' with '/<width>px-' for each width in widths.
 * Returns a string suitable for img[srcset], or null if URL doesn't match the expected pattern.
 */
const wikimediaSrcSet = (thumbUrl, widths = [320, 640, 1024]) => {
  if (!thumbUrl || typeof thumbUrl !== "string") return null;
  if (!thumbUrl.includes("/thumb/")) return null;
  const match = thumbUrl.match(/(\/)(\d+)px-/);
  if (!match) return null;
  // build entries like "https://.../640px-Filename.jpg 640w"
  const entries = widths.map((w) => {
    const s = thumbUrl.replace(/\/\d+px-/, `/${w}px-`);
    return `${s} ${w}w`;
  });
  return entries.join(", ");
};

// Choose a sensible `sizes` attribute for modal large image (adjust if your layout differs)
const defaultModalSizes = "(max-width: 900px) 100vw, 900px";

export default function Explore() {
  const navigate = useNavigate();

  // server-driven
  const [categories, setCategories] = useState([]); // from /api/interests
  const [popularLocations, setPopularLocations] = useState([]);
  const [locationsFiltered, setLocationsFiltered] = useState([]);

  // ui & state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // category selection: we keep slug for UI active state, but use id for backend queries
  const [selectedCategorySlug, setSelectedCategorySlug] = useState("todo");
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedCategoryTitle, setSelectedCategoryTitle] = useState("Todo");

  // compact filters with selects
  const [selectedDuration, setSelectedDuration] = useState("");
  const [selectedBudget, setSelectedBudget] = useState("");
  const [selectedSeason, setSelectedSeason] = useState("");

  // modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedExperience, setSelectedExperience] = useState(null);

  const scrollRoot = typeof document !== "undefined" ? document.querySelector(".explorar-main") : null;

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

  // when category changes, fetch filtered locations — use the CATEGORY ID (not slug)
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        if (selectedCategorySlug === "todo" || !selectedCategoryId) {
          const locs = await apiGet("/locations?limit=200");
          if (!mounted) return;
          const sorted = sortByRelevanceDesc(Array.isArray(locs) ? locs : []);
          setLocationsFiltered(sorted.slice(0, 50));
        } else {
          // use the id for the backend filter (interest=id)
          const locs = await apiGet(
            `/locations?interest=${encodeURIComponent(String(selectedCategoryId))}&limit=200`
          );
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
  }, [selectedCategorySlug, selectedCategoryId]);

  /**
   * Map backend location objects to the shape used by the UI.
   * Important additions:
   *  - image: the *thumbnail* URL chosen by pickBestImage (fast for the grid)
   *  - imageSrcSet: if applicable, a wikimedia-style srcset string (for modal)
   *  - imageLarge: a larger thumb-derived URL for the modal (e.g. 1024px)
   */
  const mapToExperiences = (locs) => {
    if (!Array.isArray(locs)) return [];
    return locs.map((loc) => {
      const imgs = safeParseImages(loc.images ?? loc.imagenes);
      const chosen = pickBestImage(imgs); // prefer thumbnails / small variants

      // if chosen is a wikimedia-style thumb, build srcset and a larger variant
      const imageSrcSet = chosen ? wikimediaSrcSet(chosen, [320, 640, 1024]) : null;
      // prefer a '1024px' larger thumb if possible
      let imageLarge = null;
      if (chosen && chosen.includes("/thumb/") && chosen.match(/\/\d+px-/)) {
        imageLarge = chosen.replace(/\/\d+px-/, "/1024px-");
      } else if (imgs && imgs.length) {
        // fallback: try to pick a larger file if available (maybe first element is full-size)
        imageLarge = imgs[0];
      }

      const rawTitle = loc.title ?? loc.titulo ?? loc.name ?? `Lugar #${loc.id ?? "?"}`;
      const rawDescription = loc.description ?? loc.descripcion ?? "";
      const truncated =
        rawDescription && rawDescription.length > 150 ? rawDescription.slice(0, 150) + "…" : rawDescription;

      return {
        id: loc.id,
        title: rawTitle,
        description: truncated,
        category: loc.interest ?? loc.fk_interest ?? null,
        // image used in grid (thumbnail, small)
        image: chosen,
        // image srcset for modal (if applicable)
        imageSrcSet,
        // larger variant for modal display (if available)
        imageLarge,
        raw: loc,
      };
    });
  };

  const popularExperiences = useMemo(() => mapToExperiences(popularLocations), [popularLocations]);
  const filteredExperiences = useMemo(() => mapToExperiences(locationsFiltered), [locationsFiltered]);

  // onCategoryClick now accepts either the "todo" string or the category object
  const onCategoryClick = (category) => {
    if (category === "todo") {
      setSelectedCategorySlug("todo");
      setSelectedCategoryId(null);
      setSelectedCategoryTitle("Todo");
      return;
    }
    // category is the object from categories array
    const slug = category?.slug ?? String(category);
    const id = category?.id ?? null;
    const title = category?.title ?? category?.name ?? slug;
    setSelectedCategorySlug(slug);
    setSelectedCategoryId(id);
    setSelectedCategoryTitle(title);
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
      navigator
        .share({
          title: selectedExperience.title,
          text: selectedExperience.description,
          url: window.location.href,
        })
        .catch(console.error);
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Enlace copiado al portapapeles");
    }
  };

  const clearFilters = () => {
    setSelectedCategorySlug("todo");
    setSelectedCategoryId(null);
    setSelectedCategoryTitle("Todo");
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
                    key={cat.slug ?? cat.id}
                    className={`category-card ${selectedCategorySlug === cat.slug ? "active" : ""}`}
                    onClick={() => onCategoryClick(cat)}
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
                <select
                  value={selectedDuration}
                  onChange={(e) => setSelectedDuration(e.target.value)}
                  className="filter-select"
                >
                  <option value="">Cualquiera</option>
                  <option value="corto">Corto (1-3 días)</option>
                  <option value="medio">Medio (4-7 días)</option>
                  <option value="largo">Largo (8+ días)</option>
                  <option value="fin_semana">Fin de semana</option>
                </select>
              </div>

              <div className="filter-field">
                <label>Presupuesto</label>
                <select
                  value={selectedBudget}
                  onChange={(e) => setSelectedBudget(e.target.value)}
                  className="filter-select"
                >
                  <option value="">Cualquiera</option>
                  <option value="economico">Económico</option>
                  <option value="moderado">Moderado</option>
                  <option value="lujo">Lujo</option>
                </select>
              </div>

              <div className="filter-field">
                <label>Época</label>
                <select
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(e.target.value)}
                  className="filter-select"
                >
                  <option value="">Cualquiera</option>
                  <option value="primavera">Primavera</option>
                  <option value="verano">Verano</option>
                  <option value="otono">Otoño</option>
                  <option value="invierno">Invierno</option>
                </select>
              </div>

              <div className="filter-actions">
                <button className="btn-clear" onClick={clearFilters}>
                  Borrar filtros
                </button>
                <div className="hint">Nota: filtros UI (pueden conectarse al backend)</div>
              </div>
            </div>

            {/* chips active filters */}
            <div className="active-chips">
              {selectedDuration && (
                <div className="filter-chip">
                  Duración: {selectedDuration}
                  <button className="chip-x" onClick={() => removeActiveFilter("duration")}>
                    ✕
                  </button>
                </div>
              )}
              {selectedBudget && (
                <div className="filter-chip">
                  Presupuesto: {selectedBudget}
                  <button className="chip-x" onClick={() => removeActiveFilter("budget")}>
                    ✕
                  </button>
                </div>
              )}
              {selectedSeason && (
                <div className="filter-chip">
                  Época: {selectedSeason}
                  <button className="chip-x" onClick={() => removeActiveFilter("season")}>
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* filtered results first */}
          <div className="experiences-section">
            <div className="section-header">
              <h2>{selectedCategorySlug === "todo" ? "Resultados" : `Resultados — ${selectedCategoryTitle}`}</h2>
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
                          priority={idx < 6} // primeras rápido
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
                        priority={idx < 6} // primeras rápido
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
            <button className="modal-close" onClick={() => setShowDetailModal(false)}>
              ×
            </button>

            <div className="modal-image">
              {/* Modal uses a larger image + srcset when available (Wikimedia style) */}
              {selectedExperience.imageLarge || selectedExperience.image ? (
                <img
                  src={selectedExperience.imageLarge ?? selectedExperience.image}
                  alt={selectedExperience.title}
                  // if available, include srcset for responsive large images (Wikimedia thumb pattern)
                  srcSet={selectedExperience.imageSrcSet ?? undefined}
                  sizes={selectedExperience.imageSrcSet ? defaultModalSizes : undefined}
                  style={{ width: "100%", height: "auto", borderRadius: 8 }}
                />
              ) : null}
            </div>

            <div className="modal-details">
              <h2>{selectedExperience.title}</h2>
              <p className="modal-description">{selectedExperience.description}</p>
              <div className="modal-actions">
                <button className="btn-create" onClick={handleCreateTrip}>
                  Crear plan de viaje
                </button>
                <button className="btn-share" onClick={handleShare}>
                  Compartir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
