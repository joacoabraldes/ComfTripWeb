// src/pages/Explore.js
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/explore.css";
import { apiGet } from "./api";
import OptimizedImage from "../components/OptimizedImage";
import { useTranslation } from "../i18n";
import Modal from "../components/Modal";
import ActionButton from "../components/ActionButton";
import LoadingSpinner from "../components/LoadingSpinner";
import FilterSelect from "../components/FilterSelect";
import { translateCategory, translateCategoryDescription } from "../helpers/categoryTranslations";
import { 
  FaTheaterMasks, 
  FaTree, 
  FaUtensils, 
  FaShoppingBag, 
  FaBirthdayCake, 
  FaFutbol, 
  FaOm, 
  FaUsers,
  FaGlobe,
  FaMapMarkerAlt
} from "react-icons/fa";

/**
 * Normalize many image shapes into an array of URL strings
 */
const safeParseImages = (im) => {
  if (!im) return [];
  if (Array.isArray(im)) return im.map((it) => (typeof it === "object" && it !== null && it.url ? it.url : it));
  if (typeof im === "string") {
    try {
      const parsed = JSON.parse(im);
      if (Array.isArray(parsed)) return parsed.map((it) => (typeof it === "object" && it !== null && it.url ? it.url : it));
      return [parsed];
    } catch (e) {
      if (im.includes(",")) return im.split(",").map((s) => s.trim());
      return [im];
    }
  }
  if (typeof im === "object" && im !== null) {
    if (Array.isArray(im.urls)) return im.urls;
    if (im.url) return [im.url];
  }
  return [];
};

// map slug -> React icon component
const categoryIcons = {
  cultura: FaTheaterMasks,
  naturaleza: FaTree,
  gastronomia: FaUtensils,
  compras: FaShoppingBag,
  fiestas: FaBirthdayCake,
  deportes: FaFutbol,
  relax: FaOm,
  familia: FaUsers,
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
 */
const pickBestImage = (imgs = []) => {
  if (!Array.isArray(imgs) || imgs.length === 0) return null;
  const urls = imgs.filter(Boolean).map((u) => (typeof u === "string" ? u : String(u)));
  const thumb = urls.find((u) => u.includes("/thumb/"));
  if (thumb) return thumb;
  const smallPx = urls.find((u) => /\/\d+px-/.test(u));
  if (smallPx) return smallPx;
  if (urls[1]) return urls[1];
  return urls[0] || null;
};

const wikimediaSrcSet = (thumbUrl, widths = [320, 640, 1024]) => {
  if (!thumbUrl || typeof thumbUrl !== "string") return null;
  if (!thumbUrl.includes("/thumb/")) return null;
  const match = thumbUrl.match(/(\/)(\d+)px-/);
  if (!match) return null;
  return widths
    .map((w) => {
      const s = thumbUrl.replace(/\/\d+px-/, `/${w}px-`);
      return `${s} ${w}w`;
    })
    .join(", ");
};

const defaultModalSizes = "(max-width: 900px) 100vw, 900px";

export default function Explore() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Helper function to translate filter values
  const translateFilterValue = (type, value) => {
    if (!value) return '';
    const map = {
      duration: {
        corto: t('explore.durationShort'),
        medio: t('explore.durationMedium'),
        largo: t('explore.durationLong'),
        fin_semana: t('explore.weekend'),
      },
      budget: {
        economico: t('explore.budgetEconomyLabel'),
        moderado: t('explore.budgetModerateLabel'),
        lujo: t('explore.budgetLuxuryLabel'),
      },
      season: {
        primavera: t('explore.seasonSpring'),
        verano: t('explore.seasonSummer'),
        otono: t('explore.seasonAutumn'),
        invierno: t('explore.seasonWinter'),
      },
    };
    return map[type]?.[value] || value;
  };

  // server-driven
  const [categories, setCategories] = useState([]); // from /api/interests
  const [popularLocations, setPopularLocations] = useState([]); // raw loc objects
  const [locationsFiltered, setLocationsFiltered] = useState([]); // raw loc objects

  // UI & state
  const [initialLoading, setInitialLoading] = useState(true); // blocks full-page until categories loaded
  const [locationsLoading, setLocationsLoading] = useState(true); // controls grid skeletons
  const [error, setError] = useState(null);

  // category selection: keep slug for UI active state, but use id for backend queries
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

  // --- Helpers to map backend locations to UI-friendly "experience" objects
  const mapToExperiences = (locs) => {
    if (!Array.isArray(locs)) return [];
    return locs.map((loc) => {
      const imgs = safeParseImages(loc.images ?? loc.imagenes);
      const chosen = pickBestImage(imgs);
      const imageSrcSet = chosen ? wikimediaSrcSet(chosen, [320, 640, 1024]) : null;
      let imageLarge = null;
      if (chosen && chosen.includes("/thumb/") && chosen.match(/\/\d+px-/)) {
        imageLarge = chosen.replace(/\/\d+px-/, "/1024px-");
      } else if (imgs && imgs.length) {
        imageLarge = imgs[0];
      }

      const rawTitle = loc.title ?? loc.titulo ?? loc.name ?? `Lugar #${loc.id ?? "?"}`;
      const rawDescription = loc.description ?? loc.descripcion ?? "";
      const truncated = rawDescription && rawDescription.length > 150 ? rawDescription.slice(0, 150) + "…" : rawDescription;

      return {
        id: loc.id,
        title: rawTitle,
        description: truncated,
        category: loc.interest ?? loc.fk_interest ?? null,
        image: chosen,
        imageSrcSet,
        imageLarge,
        raw: loc,
      };
    });
  };

  const popularExperiences = useMemo(() => mapToExperiences(popularLocations), [popularLocations]);
  const filteredExperiences = useMemo(() => mapToExperiences(locationsFiltered), [locationsFiltered]);

  // --- Fetch categories and start background location fetch
  useEffect(() => {
    let mounted = true;

    const loadInitial = async () => {
      setError(null);
      try {
        // fetch categories first so UI can show immediately
        const cats = await apiGet("/interests");
        if (!mounted) return;
        setCategories(Array.isArray(cats) ? cats : []);
        setInitialLoading(false); // page can render now (header, categories, controls)

        // now fetch locations in background (parallel-ish)
        setLocationsLoading(true);
        try {
          const locs = await apiGet("/locations?limit=200");
          if (!mounted) return;
          const sorted = sortByRelevanceDesc(Array.isArray(locs) ? locs : []);
          // keep small initial set for performance (grid will render quickly)
          setPopularLocations(sorted.slice(0, 12));
          setLocationsFiltered(sorted.slice(0, 50));
        } catch (locErr) {
          console.error("Locations fetch error:", locErr);
          // locationsLoading false but show message in-grid
          setPopularLocations([]);
          setLocationsFiltered([]);
          setError(t('explore.loadLocationsError'));
        } finally {
          if (mounted) setLocationsLoading(false);
        }
      } catch (catErr) {
        console.error("Categories fetch error:", catErr);
        if (!mounted) return;
        setError(t('explore.loadCategoriesError'));
        // allow page render but categories list will be empty
        setInitialLoading(false);
        setLocationsLoading(false);
      }
    };

    loadInitial();
    return () => (mounted = false);
  }, []);

  // when category changes, fetch filtered locations — only update the grid (don't block full page)
  useEffect(() => {
    let mounted = true;
    const loadFiltered = async () => {
      setError(null);
      setLocationsLoading(true);
      try {
        if (selectedCategorySlug === "todo" || !selectedCategoryId) {
          const locs = await apiGet("/locations?limit=200");
          if (!mounted) return;
          const sorted = sortByRelevanceDesc(Array.isArray(locs) ? locs : []);
          setLocationsFiltered(sorted.slice(0, 50));
        } else {
          // use id for backend filter
          const locs = await apiGet(`/locations?interest=${encodeURIComponent(String(selectedCategoryId))}&limit=200`);
          if (!mounted) return;
          const sorted = sortByRelevanceDesc(Array.isArray(locs) ? locs : []);
          setLocationsFiltered(sorted);
        }
      } catch (err) {
        console.error("Error fetching filtered locations:", err);
        if (!mounted) return;
        setLocationsFiltered([]);
        setError(t('explore.loadFilteredError'));
      } finally {
        if (mounted) setLocationsLoading(false);
      }
    };
    // run it (but only after initial load of categories completed)
    if (!initialLoading) loadFiltered();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategorySlug, selectedCategoryId]);

  // onCategoryClick accepts either "todo" or the category object
  const onCategoryClick = (category) => {
    if (category === "todo") {
      setSelectedCategorySlug("todo");
      setSelectedCategoryId(null);
      setSelectedCategoryTitle(t('explore.all'));
      return;
    }
    const slug = category?.slug ?? String(category);
    const id = category?.id ?? null;
    const title = category?.title ?? category?.name ?? slug;
    const translatedTitle = translateCategory(t, slug, title);
    setSelectedCategorySlug(slug);
    setSelectedCategoryId(id);
    setSelectedCategoryTitle(translatedTitle);
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
      alert(t('explore.linkCopied'));
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

  // --- Small skeleton helper for grid while locations load
  const renderGridSkeleton = (count = 6) => {
    const arr = Array.from({ length: count }, (_, i) => i);
    return (
      <div className="experiences-grid">
        {arr.map((i) => (
          <div className="experience-card skeleton" key={`s-${i}`}>
            <div className="card-image">
              <div className="img-skeleton" style={{ height: 0, paddingBottom: `${(260 / 400) * 100}%` }} />
            </div>
            <div className="card-content">
              <div className="skeleton-line title" />
              <div className="skeleton-line desc" />
            </div>
          </div>
        ))}
      </div>
    );
  };

  // --- Render blocking only when initialLoading (categories) are still being fetched
  if (initialLoading) {
    return (
      <div className="explorar-page">
        <LoadingSpinner message={t('common.loading')} fullScreen />
      </div>
    );
  }

  // main render (categories already loaded)
  return (
    <div className="explorar-page">
      <main className="explorar-main">
        <div className="explorar-container">
          <h1 className="explorar-title">{t('explore.title')}</h1>

          {/* categories */}
          <div className="categories-section">
            <div className="categories-grid">
              <div
                className={`category-card ${selectedCategorySlug === "todo" ? "active" : ""}`}
                onClick={() => onCategoryClick("todo")}
              >
                <div className="category-icon"><FaGlobe /></div>
                <div className="category-name">{t('explore.all')}</div>
              </div>

              {categories.map((cat) => {
                const IconComponent = categoryIcons[cat.slug] || FaMapMarkerAlt;
                const slug = cat.slug ?? String(cat.id ?? "");
                const translatedTitle = translateCategory(t, slug, cat.title);
                return (
                  <div
                    key={cat.slug ?? cat.id}
                    className={`category-card ${selectedCategorySlug === cat.slug ? "active" : ""}`}
                    onClick={() => onCategoryClick(cat)}
                  >
                    <div className="category-icon"><IconComponent /></div>
                    <div className="category-name">{translatedTitle}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* filters compact */}
          <div className="filters-section compact">
            <div className="filters-row">
              <div className="filter-field">
                <label>{t('explore.duration')}</label>
                  <FilterSelect
                      value={selectedDuration}
                      onChange={setSelectedDuration}
                      placeholder={t('explore.any')}
                      options={[
                          { value: "", label: t('explore.any') }, // ← opción vacía
                          { value: "corto", label: t('explore.short') },
                          { value: "medio", label: t('explore.medium') },
                          { value: "largo", label: t('explore.long') },
                          { value: "fin_semana", label: t('explore.weekend') },
                      ]}
                      isClearable={false}
                  />

              </div>

              <div className="filter-field">
                <label>{t('explore.budget')}</label>
                  <FilterSelect
                      value={selectedBudget}
                      onChange={setSelectedBudget}
                      placeholder={t('explore.any')}
                      options={[
                          { value: "", label: t('explore.any') }, // ← opción vacía
                          { value: "economico", label: t('explore.budgetEconomy') },
                          { value: "moderado", label: t('explore.budgetModerate') },
                          { value: "lujo", label: t('explore.budgetLuxury') },
                      ]}
                      isClearable={false}
                  />

              </div>

              <div className="filter-field">
                <label>{t('explore.season')}</label>
                  <FilterSelect
                      value={selectedSeason}
                      onChange={setSelectedSeason}
                      placeholder={t('explore.any')}
                      options={[
                          { value: "", label: t('explore.any') }, // ← opción vacía
                          { value: "primavera", label: t('explore.spring') },
                          { value: "verano", label: t('explore.summer') },
                          { value: "otono", label: t('explore.autumn') },
                          { value: "invierno", label: t('explore.winter') },
                      ]}
                      isClearable={false}
                  />

              </div>

              <div className="filter-actions">
                <button className="btn-clear" onClick={clearFilters}>{t('explore.clearFilters')}</button>
                <div className="hint">{t('explore.filtersNote')}</div>
              </div>
            </div>

            {/* chips active filters */}
            <div className="active-chips">
              {selectedDuration && (
                <div className="filter-chip">
                  {t('explore.durationLabel')}: {translateFilterValue('duration', selectedDuration)}
                  <button className="chip-x" onClick={() => removeActiveFilter("duration")}>✕</button>
                </div>
              )}
              {selectedBudget && (
                <div className="filter-chip">
                  {t('explore.budgetLabel')}: {translateFilterValue('budget', selectedBudget)}
                  <button className="chip-x" onClick={() => removeActiveFilter("budget")}>✕</button>
                </div>
              )}
              {selectedSeason && (
                <div className="filter-chip">
                  {t('explore.seasonLabel')}: {translateFilterValue('season', selectedSeason)}
                  <button className="chip-x" onClick={() => removeActiveFilter("season")}>✕</button>
                </div>
              )}
            </div>
          </div>

          {/* filtered results first */}
          <div className="experiences-section">
            <div className="section-header">
              <h2>{selectedCategorySlug === "todo" ? t('explore.results') : `${t('explore.results')} — ${selectedCategoryTitle}`}</h2>
              <div className="small-muted">{filteredExperiences.length} {t('explore.resultsCount')}</div>
            </div>

            {locationsLoading ? (
              // show skeleton grid while locations load
              renderGridSkeleton(8)
            ) : error && filteredExperiences.length === 0 ? (
              <div className="muted error">{error}</div>
            ) : (
              <div className="experiences-grid">
                {filteredExperiences.length === 0 ? (
                  <div className="muted">{t('explore.noPlacesForCategory')}</div>
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
                            priority={idx < 6}
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
            )}
          </div>

          {/* popular below */}
          <div className="experiences-section">
            <div className="section-header">
              <h2>{t('explore.popular')}</h2>
            </div>

            {locationsLoading ? (
              renderGridSkeleton(6)
            ) : (
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
                          priority={idx < 6}
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
            )}
          </div>
        </div>
      </main>

      {/* modal */}
      <Modal
        isOpen={showDetailModal && !!selectedExperience}
        onClose={() => setShowDetailModal(false)}
      >
        {selectedExperience && (
          <>
            <div className="modal-image">
              {(selectedExperience.imageLarge || selectedExperience.image) &&(
                <img
                  src={selectedExperience.imageLarge ?? selectedExperience.image}
                  alt={selectedExperience.title}
                  srcSet={selectedExperience.imageSrcSet ?? undefined}
                  sizes={selectedExperience.imageSrcSet ? defaultModalSizes : undefined}
                  style={{ width: "100%", height: "auto", borderRadius: 8 }}
                />
              )}
            </div>
            <div className="modal-details  glass-details">
              <h2>{selectedExperience.title}</h2>
              <p className="modal-description">{selectedExperience.description}</p>
              <div className="modal-actions">
                <ActionButton variant="create" onClick={handleCreateTrip}>
                  {t('explore.createTripPlan')}
                </ActionButton>
                <ActionButton variant="share" onClick={handleShare}>
                  {t('explore.share')}
                </ActionButton>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
