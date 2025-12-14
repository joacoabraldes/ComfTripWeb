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
import { translateCategory } from "../helpers/categoryTranslations";
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
  FaMapMarkerAlt,
} from "react-icons/fa";

/**
 * Normaliza muchas formas distintas de `imagenes` a un array de URLs de string.
 */
const safeParseImages = (im) => {
  if (!im) return [];
  if (Array.isArray(im))
    return im.map((it) =>
      typeof it === "object" && it !== null && it.url ? it.url : it
    );
  if (typeof im === "string") {
    try {
      const parsed = JSON.parse(im);
      if (Array.isArray(parsed))
        return parsed.map((it) =>
          typeof it === "object" && it !== null && it.url ? it.url : it
        );
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

// map slug -> React icon
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
 * Elige la mejor imagen candidata.
 */
const pickBestImage = (imgs = []) => {
  if (!Array.isArray(imgs) || imgs.length === 0) return null;
  const urls = imgs
    .filter(Boolean)
    .map((u) => (typeof u === "string" ? u : String(u)));
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

  // server-driven
  const [categories, setCategories] = useState([]);
  const [allLocations, setAllLocations] = useState([]);
  const [userTrips, setUserTrips] = useState([]);

  // UI & state
  const [initialLoading, setInitialLoading] = useState(true);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [error, setError] = useState(null);

  // categoría elegida (slug de interests)
  const [selectedCategorySlug, setSelectedCategorySlug] = useState("todo");
  const [selectedCategoryTitle, setSelectedCategoryTitle] =
    useState("Todo");

  // filtros de lugares (NO de viaje)
  const [filterCountry, setFilterCountry] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [sortBy, setSortBy] = useState("relevance"); // 'relevance' | 'name'

  // modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedExperience, setSelectedExperience] = useState(null);

  const scrollRoot =
    typeof document !== "undefined"
      ? document.querySelector(".explorar-main")
      : null;

  // ---- helpers de mapeo location -> "experience" para la UI
  const mapToExperiences = (locs) => {
    if (!Array.isArray(locs)) return [];
    return locs.map((loc) => {
      const imgs = safeParseImages(loc.images ?? loc.imagenes);
      const chosen = pickBestImage(imgs);
      const imageSrcSet = chosen
        ? wikimediaSrcSet(chosen, [320, 640, 1024])
        : null;
      let imageLarge = null;
      if (chosen && chosen.includes("/thumb/") && chosen.match(/\/\d+px-/)) {
        imageLarge = chosen.replace(/\/\d+px-/, "/1024px-");
      } else if (imgs && imgs.length) {
        imageLarge = imgs[0];
      }

      const rawTitle =
        loc.title ?? loc.titulo ?? loc.name ?? `Lugar #${loc.id ?? "?"}`;
      const rawDescription = loc.description ?? loc.descripcion ?? "";
      const truncated =
        rawDescription && rawDescription.length > 150
          ? rawDescription.slice(0, 150) + "…"
          : rawDescription;

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

  // ------- carga inicial: categorías, locations y trips
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setError(null);
      try {
        const [catsRes, locsRes] = await Promise.all([
          apiGet("/interests"),
          apiGet("/locations?limit=400"),
        ]);

        if (!mounted) return;

        const cats = Array.isArray(catsRes) ? catsRes : [];
        setCategories(cats);

        const locArray = Array.isArray(locsRes)
          ? locsRes
          : locsRes?.rows || [];
        const sorted = sortByRelevanceDesc(locArray);
        setAllLocations(sorted);

        setInitialLoading(false);
        setLocationsLoading(false);
      } catch (err) {
        console.error("Initial load Explore error:", err);
        if (!mounted) return;
        setError("No se pudieron cargar los lugares.");
        setInitialLoading(false);
        setLocationsLoading(false);
      }

      // trips: si falla o el user no está logueado, simplemente no mostramos sección de viaje
      try {
        const tripsRes = await apiGet("/trips");
        if (!mounted) return;
        const tripsArr = Array.isArray(tripsRes)
          ? tripsRes
          : tripsRes?.rows || [];
        setUserTrips(tripsArr);
      } catch (err) {
        console.error("Trips fetch error:", err);
        // sin drama, solo no mostramos sección de viaje
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // ---- experiencias globales (todas, ordenadas por relevancia)
  const worldwideExperiences = useMemo(
    () => mapToExperiences(allLocations),
    [allLocations]
  );

  // ---- sección "Populares mundialmente"
  const popularExperiences = useMemo(
    () => worldwideExperiences.slice(0, 12),
    [worldwideExperiences]
  );

  // ---- determinar viaje de contexto (activo o más cercano en el tiempo)
  const tripContext = useMemo(() => {
    if (!userTrips || userTrips.length === 0) return null;

    const parseDate = (d) => (d ? new Date(d) : null);
    const today = new Date();

    const tripsWithDates = userTrips.map((t) => ({
      ...t,
      start: parseDate(t.start_date || t.startDate),
      end: parseDate(t.end_date || t.endDate),
    }));

    const active = tripsWithDates.filter(
      (t) =>
        t.start && t.end && t.start <= today && t.end >= today
    );
    if (active.length > 0) {
      active.sort((a, b) => a.end - b.end);
      return active[0];
    }

    // viaje más cercano (pasado o futuro)
    tripsWithDates.sort((a, b) => {
      const refA = tRefDate(a, today);
      const refB = tRefDate(b, today);
      return Math.abs(refA - today) - Math.abs(refB - today);
    });

    return tripsWithDates[0] || null;
  }, [userTrips]);

  function tRefDate(t, today) {
    if (t.start) return t.start;
    if (t.end) return t.end;
    return today;
  }

  // ---- mapear destino del viaje a un país de locations
  const tripCountry = useMemo(() => {
    if (!tripContext || !allLocations.length) return null;
    const destination = (tripContext.destination || "").trim();
    if (!destination) return null;

    const destLower = destination.toLowerCase();

    const countries = Array.from(
      new Set(
        allLocations
          .map((l) => (l.country || "").trim())
          .filter(Boolean)
      )
    );

    // 1) match exacto
    let found = countries.find(
      (c) => c.toLowerCase() === destLower
    );
    if (found) return found;

    // 2) city -> country
    const locByCity = allLocations.find(
      (loc) =>
        (loc.city || "").toLowerCase() === destLower
    );
    if (locByCity && locByCity.country) return locByCity.country;

    // 3) substring (Argentina / Buenos Aires, etc.)
    found = countries.find((c) => {
      const lc = c.toLowerCase();
      return lc.includes(destLower) || destLower.includes(lc);
    });
    return found || null;
  }, [tripContext, allLocations]);

  const tripContextTitle = useMemo(() => {
    if (!tripContext) return null;
    return tripContext.destination || tripCountry || null;
  }, [tripContext, tripCountry]);

  // ---- lugares para el país del viaje de contexto
  const tripExperiences = useMemo(() => {
    if (!tripCountry) return [];
    const locs = allLocations.filter(
      (loc) =>
        (loc.country || "").toLowerCase() ===
        tripCountry.toLowerCase()
    );
    return mapToExperiences(locs).slice(0, 8);
  }, [tripCountry, allLocations]);

  // ---- opciones de país y ciudad para los filtros
  const countryOptions = useMemo(() => {
    const set = new Set();
    allLocations.forEach((loc) => {
      const c = (loc.country || "").trim();
      if (c) set.add(c);
    });
    const arr = Array.from(set).sort((a, b) => a.localeCompare(b));
    return [
      { value: "", label: t("explore.any") },
      ...arr.map((c) => ({ value: c, label: c })),
    ];
  }, [allLocations, t]);

  const cityOptions = useMemo(() => {
    const set = new Set();
    allLocations.forEach((loc) => {
      const city = (loc.city || "").trim();
      if (!city) return;
      if (filterCountry && loc.country !== filterCountry) return;
      set.add(city);
    });
    const arr = Array.from(set).sort((a, b) => a.localeCompare(b));
    return [
      { value: "", label: t("explore.any") },
      ...arr.map((c) => ({ value: c, label: c })),
    ];
  }, [allLocations, filterCountry, t]);

  const sortOptions = useMemo(
    () => [
      { value: "relevance", label: "Más relevantes" },
      { value: "name", label: "Nombre (A-Z)" },
    ],
    []
  );

  // ---- aplicar filtros (categoría, país, ciudad, orden) al grid principal
  const filteredExperiences = useMemo(() => {
    let exps = worldwideExperiences;

    // categoría
    if (selectedCategorySlug !== "todo") {
      const slugLower = selectedCategorySlug.toLowerCase();
      exps = exps.filter((exp) => {
        const cat = (exp.category || "").toLowerCase();
        return cat === slugLower;
      });
    }

    // país
    if (filterCountry) {
      const cLower = filterCountry.toLowerCase();
      exps = exps.filter(
        (exp) =>
          (exp.raw?.country || "").toLowerCase() === cLower
      );
    }

    // ciudad
    if (filterCity) {
      const cityLower = filterCity.toLowerCase();
      exps = exps.filter(
        (exp) =>
          (exp.raw?.city || "").toLowerCase() === cityLower
      );
    }

    // orden
    if (sortBy === "name") {
      exps = [...exps].sort((a, b) =>
        a.title.localeCompare(b.title)
      );
    }
    // si es "relevance", ya vienen ordenados por relevancia

    return exps;
  }, [
    worldwideExperiences,
    selectedCategorySlug,
    filterCountry,
    filterCity,
    sortBy,
  ]);

  // ---- callbacks UI
  const onCategoryClick = (category) => {
    if (category === "todo") {
      setSelectedCategorySlug("todo");
      setSelectedCategoryTitle(t("explore.all"));
      return;
    }
    const slug = category?.slug ?? String(category);
    const title = category?.title ?? category?.name ?? slug;
    const translatedTitle = translateCategory(t, slug, title);
    setSelectedCategorySlug(slug);
    setSelectedCategoryTitle(translatedTitle);
  };

  const handleExperienceClick = (experience) => {
    setSelectedExperience(experience);
    setShowDetailModal(true);
  };

  const handleCreateTrip = () => {
    setShowDetailModal(false);
    navigate("/add-trip", {
      state: { destination: selectedExperience?.title ?? "" },
    });
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
      alert(t("explore.linkCopied"));
    }
  };

  const clearFilters = () => {
    setSelectedCategorySlug("todo");
    setSelectedCategoryTitle("Todo");
    setFilterCountry("");
    setFilterCity("");
    setSortBy("relevance");
  };

  const removeActiveFilter = (type) => {
    if (type === "country") setFilterCountry("");
    if (type === "city") setFilterCity("");
    if (type === "sort") setSortBy("relevance");
  };

  // ---- skeleton mientras cargan locations
  const renderGridSkeleton = (count = 6) => {
    const arr = Array.from({ length: count }, (_, i) => i);
    return (
      <div className="experiences-grid">
        {arr.map((i) => (
          <div className="experience-card skeleton" key={`s-${i}`}>
            <div className="card-image">
              <div
                className="img-skeleton"
                style={{ height: 0, paddingBottom: `${(260 / 400) * 100}%` }}
              />
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

  // ---- bloqueamos solo mientras carga TODO por primera vez
  if (initialLoading) {
    return (
      <div className="explorar-page">
        <LoadingSpinner message={t("common.loading")} fullScreen />
      </div>
    );
  }

  // ---- render principal
  return (
    <div className="explorar-page">
      <main className="explorar-main">
        <div className="explorar-container">
          <h1 className="explorar-title">{t("explore.title")}</h1>

          {/* CATEGORÍAS */}
          <div className="categories-section">
            <div className="categories-grid">
              <div
                className={`category-card ${
                  selectedCategorySlug === "todo" ? "active" : ""
                }`}
                onClick={() => onCategoryClick("todo")}
              >
                <div className="category-icon">
                  <FaGlobe />
                </div>
                <div className="category-name">
                  {t("explore.all")}
                </div>
              </div>

              {categories.map((cat) => {
                const IconComponent =
                  categoryIcons[cat.slug] || FaMapMarkerAlt;
                const slug = cat.slug ?? String(cat.id ?? "");
                const translatedTitle = translateCategory(
                  t,
                  slug,
                  cat.title
                );
                return (
                  <div
                    key={cat.slug ?? cat.id}
                    className={`category-card ${
                      selectedCategorySlug === cat.slug ? "active" : ""
                    }`}
                    onClick={() => onCategoryClick(cat)}
                  >
                    <div className="category-icon">
                      <IconComponent />
                    </div>
                    <div className="category-name">
                      {translatedTitle}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECCIÓN VIAJE ACTUAL / MÁS CERCANO */}
          {tripExperiences.length > 0 && tripContextTitle && (
            <div className="experiences-section">
              <div className="section-header">
                <h2>
                  Lugares para tu viaje a {tripContextTitle}
                </h2>
                <div className="small-muted">
                  Basado en tu viaje{" "}
                  {tripContext.start_date
                    ? `(${tripContext.start_date} – ${tripContext.end_date || "?"})`
                    : ""}
                </div>
              </div>

              {locationsLoading ? (
                renderGridSkeleton(6)
              ) : (
                <div className="experiences-grid">
                  {tripExperiences.map((exp, idx) => (
                    <div
                      key={exp.id}
                      className="experience-card"
                      onClick={() => handleExperienceClick(exp)}
                    >
                      <div className="card-image">
                        {exp.image ? (
                          <OptimizedImage
                            src={exp.image}
                            alt={exp.title}
                            width={400}
                            height={260}
                            scrollRoot={scrollRoot}
                            priority={idx < 4}
                          />
                        ) : (
                          <div className="no-image">No image</div>
                        )}
                      </div>
                      <div className="card-content">
                        <h3 className="card-title">{exp.title}</h3>
                        <p className="card-description">
                          {exp.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* FILTROS LÓGICOS PARA LUGARES */}
          <div className="filters-section compact">
            <div className="filters-row">
              <div className="filter-field">
                <label>País</label>
                <FilterSelect
                  value={filterCountry}
                  onChange={(val) => {
                    setFilterCountry(val);
                    // si cambia país, reseteamos ciudad
                    setFilterCity("");
                  }}
                  placeholder={t("explore.any")}
                  options={countryOptions}
                  isClearable={false}
                />
              </div>

              <div className="filter-field">
                <label>Ciudad</label>
                <FilterSelect
                  value={filterCity}
                  onChange={setFilterCity}
                  placeholder={t("explore.any")}
                  options={cityOptions}
                  isClearable={false}
                />
              </div>

              <div className="filter-field">
                <label>Ordenar por</label>
                <FilterSelect
                  value={sortBy}
                  onChange={setSortBy}
                  placeholder="Más relevantes"
                  options={sortOptions}
                  isClearable={false}
                />
              </div>

              <div className="filter-actions">
                <button className="btn-clear" onClick={clearFilters}>
                  {t("explore.clearFilters")}
                </button>
                <div className="hint">
                  Estos filtros se aplican a los lugares
                  recomendados, no a tus viajes.
                </div>
              </div>
            </div>

            {/* chips filtros activos */}
            <div className="active-chips">
              {filterCountry && (
                <div className="filter-chip">
                  País: {filterCountry}
                  <button
                    className="chip-x"
                    onClick={() => removeActiveFilter("country")}
                  >
                    ✕
                  </button>
                </div>
              )}
              {filterCity && (
                <div className="filter-chip">
                  Ciudad: {filterCity}
                  <button
                    className="chip-x"
                    onClick={() => removeActiveFilter("city")}
                  >
                    ✕
                  </button>
                </div>
              )}
              {sortBy !== "relevance" && (
                <div className="filter-chip">
                  Orden:{" "}
                  {
                    sortOptions.find((o) => o.value === sortBy)
                      ?.label
                  }
                  <button
                    className="chip-x"
                    onClick={() => removeActiveFilter("sort")}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RESULTADOS PRINCIPALES (relevantes mundialmente + filtros) */}
          <div className="experiences-section">
            <div className="section-header">
              <h2>
                {selectedCategorySlug === "todo"
                  ? "Lugares recomendados en el mundo"
                  : `Lugares de ${selectedCategoryTitle}`}
              </h2>
              <div className="small-muted">
                {filteredExperiences.length}{" "}
                {t("explore.resultsCount")}
              </div>
            </div>

            {locationsLoading ? (
              renderGridSkeleton(8)
            ) : error && filteredExperiences.length === 0 ? (
              <div className="muted error">{error}</div>
            ) : (
              <div className="experiences-grid">
                {filteredExperiences.length === 0 ? (
                  <div className="muted">
                    {t("explore.noPlacesForCategory")}
                  </div>
                ) : (
                  filteredExperiences.map((exp, idx) => (
                    <div
                      key={exp.id}
                      className="experience-card"
                      onClick={() => handleExperienceClick(exp)}
                    >
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
                        <p className="card-description">
                          {exp.description}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* EXTRA: sección “populares” siguiendo igual idea de antes */}
          <div className="experiences-section">
            <div className="section-header">
              <h2>{t("explore.popular")}</h2>
            </div>

            {locationsLoading ? (
              renderGridSkeleton(6)
            ) : (
              <div className="experiences-grid">
                {popularExperiences.map((exp, idx) => (
                  <div
                    key={exp.id}
                    className="experience-card"
                    onClick={() => handleExperienceClick(exp)}
                  >
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
                      <p className="card-description">
                        {exp.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* MODAL */}
      <Modal
        isOpen={showDetailModal && !!selectedExperience}
        onClose={() => setShowDetailModal(false)}
      >
        {selectedExperience && (
          <>
            <div className="modal-image">
              {(selectedExperience.imageLarge ||
                selectedExperience.image) && (
                <img
                  src={
                    selectedExperience.imageLarge ??
                    selectedExperience.image
                  }
                  alt={selectedExperience.title}
                  srcSet={
                    selectedExperience.imageSrcSet ?? undefined
                  }
                  sizes={
                    selectedExperience.imageSrcSet
                      ? defaultModalSizes
                      : undefined
                  }
                  style={{
                    width: "100%",
                    height: "auto",
                    borderRadius: 8,
                  }}
                />
              )}
            </div>
            <div className="modal-details glass-details">
              <h2>{selectedExperience.title}</h2>
              <p className="modal-description">
                {selectedExperience.description}
              </p>
              <div className="modal-actions">
                <ActionButton variant="create" onClick={handleCreateTrip}>
                  {t("explore.createTripPlan")}
                </ActionButton>
                <ActionButton variant="share" onClick={handleShare}>
                  {t("explore.share")}
                </ActionButton>
              </div>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
