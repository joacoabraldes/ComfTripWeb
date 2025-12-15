import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import "../styles/trips.css";
import { FaShare, FaMapMarkerAlt, FaCalendar, FaSortAmountDown, FaSortAmountUp, FaEdit, FaTrash } from "react-icons/fa";
import "../styles/header.css";
import { apiGet, apiDelete } from "./api";
import { useTranslation } from "../i18n";
import { formatDate, formatDateRange, normalizeDate, isTripCurrent } from "../utils/dateUtils";
import ShareTripModal from "../components/ShareTripModal";
import IconButton from "../components/IconButton";
import LoadingSpinner from "../components/LoadingSpinner";
import ConfirmDialog from "../components/ConfirmDialog";
import EmptyState from "../components/EmptyState";
import FilterSelect from "../components/FilterSelect";

export default function Trips() {
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [menuOpen, setMenuOpen] = useState(null);
  const navigate = useNavigate();
  const { t } = useTranslation();
    const { user } = useAuth();

  // estados para compartir viajes
  const [showShareModal, setShowShareModal] = useState(false);
  const [tripToShare, setTripToShare] = useState(null);
  
  // estado para confirmación de eliminación
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, trip: null });

    const [typeFilter, setTypeFilter] = useState("");
    const [countryFilter, setCountryFilter] = useState("");
    const [provinceFilter, setProvinceFilter] = useState("");
    const [creatorFilter, setCreatorFilter] = useState("");
    const [friends, setFriends] = useState([]);

    const [sortBy, setSortBy] = useState("trip_date"); // 'trip_date' o 'created_at'
    const [sortOrder, setSortOrder] = useState("desc"); // 'asc' o 'desc'


// opciones dinámicas
    const [availableCountries, setAvailableCountries] = useState([]);
    const [availableProvinces, setAvailableProvinces] = useState([]);

    // obtener ID del usuario actual desde token
  const getCurrentUserId = () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      const parts = token.split('.');
      if (parts.length < 2) return null;
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload && (payload.id || payload.userId || payload.sub || payload.user_id)
        ? Number(payload.id || payload.userId || payload.sub || payload.user_id)
        : null;
    } catch (e) {
      return null;
    }
  };



  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await apiGet("/trips");
        const fRes = await apiGet("/friends");
        if (!mounted) return;

        const friendsArr = Array.isArray(fRes) ? fRes : (fRes && fRes.rows ? fRes.rows : []);
        setFriends(friendsArr);

        if (Array.isArray(res)) {
          const sorted = [...res].sort((a, b) => {
            const aNow = isTripCurrent(a.start_date, a.end_date);
            const bNow = isTripCurrent(b.start_date, b.end_date);
            if (aNow && !bNow) setSelectedTrip(a)
            if (!aNow && bNow) setSelectedTrip(b);
            return normalizeDate(b.start_date) - normalizeDate(a.start_date);
          });
          setTrips(sorted);
        } else {
          setTrips([]);
        }
      } catch (err) {
        console.error("Error cargando viajes:", err);
        alert(t('trips.loadError'));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

    const getCreatorName = (trip) => {
        const creator = friends.find(f => Number(f.id) === Number(trip.user_id));
        if (!creator) return "";
        return creator.username || creator.name || creator.email;
    };


    useEffect(() => {
        const countries = [...new Set(trips.map(t => t.destination.split(",")[1]).filter(Boolean))];
        setAvailableCountries(countries);
    }, [trips]);

    useEffect(() => {
        setProvinceFilter("");
        if (countryFilter) {
            const provinces = [...new Set(
                trips.filter(t => t.destination.split(",")[1] === countryFilter)
                    .map(t => t.destination.split(",")[0])
                    .filter(Boolean)
            )];
            setAvailableProvinces(provinces);
        } else {
            setAvailableProvinces([]);
        }
    }, [countryFilter, trips]);


    const filteredTrips = trips.filter(tri => {
        const start = normalizeDate(tri.start_date);
        const end = normalizeDate(tri.end_date);
        const today = new Date();

        // Tipo de viaje
        if (typeFilter === "current" && !isTripCurrent(tri.start_date, tri.end_date)) return false;
        if (typeFilter === "upcoming" && !(today < start)) return false;
        if (typeFilter === "past" && !(today > end)) return false;

        // País / provincia
        if (countryFilter && tri.destination.split(",")[1] !== countryFilter) return false;
        if (provinceFilter && tri.destination.split(",")[0] !== provinceFilter) return false;

        // Creador
        const isMine = user.id && Number(tri.user_id) === Number(user.id);
        if (creatorFilter === "me" && !isMine) return false;
        else if (creatorFilter === "others" && isMine) return false;

        return true;
    });

    const sortedTrips = [...filteredTrips].sort((a, b) => {
        let aValue, bValue;

        if (sortBy === "trip_date") {
            aValue = normalizeDate(a.start_date);
            bValue = normalizeDate(b.start_date);
        } else {
            aValue = normalizeDate(a.created_at);
            bValue = normalizeDate(b.created_at);
        }

        return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
    });



  // funciones para compartir viajes
  function openShareModal(trip) {
    setTripToShare(trip);
    setShowShareModal(true);
  }

  function handleShareSuccess() {
    // Optionally refresh trips or show success message
  }

  if (loading) {
    return (
      <div className="trips-root">
        <LoadingSpinner message={t('trips.loading')} fullScreen />
      </div>
    );
  }

  return (
    <div className="trips-root">
      <main className="trips-main">

          {trips.length === 0 ? (
            <EmptyState 
              message={t('trips.empty')} 
              subtitle={t('trips.emptySubtitle')}
              className="trips-message"
            />
          ) : (
            <>
              <h3 className="trips-list-title">{t('trips.title')}</h3>
                <div className="trips-filters">
                    <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center", flex: 1 }}>
                        <FilterSelect
                            value={typeFilter}
                            onChange={setTypeFilter}
                            placeholder={t('trips.filters.all')}
                            options={[
                                { value: 'current', label: t('trips.filters.current') },
                                { value: 'upcoming', label: t('trips.filters.upcoming') },
                                { value: 'past', label: t('trips.filters.past') },
                            ]}
                        />

                        <FilterSelect
                            value={countryFilter}
                            onChange={setCountryFilter}
                            placeholder={t('trips.filters.allCountries')}
                            options={availableCountries.map(c => ({ value: c, label: c }))}
                        />

                        <FilterSelect
                            value={provinceFilter}
                            onChange={setProvinceFilter}
                            placeholder={t('trips.filters.allCities')}
                            disabled={!countryFilter}
                            options={availableProvinces.map(p => ({ value: p, label: p }))}
                        />

                        <FilterSelect
                            value={creatorFilter}
                            onChange={setCreatorFilter}
                            placeholder={t('trips.filters.allCreators')}
                            options={[
                                { value: 'me', label: t('trips.filters.createdByMe') },
                                { value: 'others', label: t('trips.filters.createdByOthers') },
                            ]}
                        />
                    </div>

                    {/* NUEVOS CONTROLES A LA DERECHA */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginLeft: "auto" }}>
                        {t('trips.filters.sortBy')}
                        <FilterSelect
                            value={sortBy}
                            onChange={setSortBy}
                            placeholder={t('trips.filters.sortByTripDate')}
                            options={[
                                { value: 'trip_date', label: t('trips.filters.sortByTripDate') },
                                { value: 'created_at', label: t('trips.filters.sortByCreated') },
                            ]}
                            isClearable={false}
                        >
                        </FilterSelect>

                        <button
                            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                            style={{
                                border: "1px solid #ddd",
                                borderRadius: "8px",
                                background: "#fff",
                                padding: "8px 12px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                            title={sortOrder === "asc" ? t('trips.filters.ascending') : t('trips.filters.descending')}
                        >
                            {sortOrder === "asc" ? (
                                <FaSortAmountUp size={22} color="#333" />
                            ) : (
                                <FaSortAmountDown size={22} color="#333" />
                            )}
                        </button>

                    </div>
                </div>

                <div style={{background:"#ff3951", height:2, marginBottom:20, marginTop:20}}></div>


                <div className="trips-list" role="list">
                {sortedTrips.map((trip) => {
                  const isOwner = user.id ? Number(trip.user_id) === Number(user.id) : null;
                  return (
                    <div
                      key={trip.id}
                      className={`trips-list-item ${selectedTrip && selectedTrip.id === trip.id ? "active" : ""}`}
                      role="listitem"
                    >
                      <div
                        className="trip-item-main"
                        onClick={() => navigate(`/trip_itinerary/${trip.id}`)}
                      >
                        <div className="trip-destination"><FaMapMarkerAlt size={28} color="#ff3951" style={{ marginRight: 12, marginBottom:-3 }} />
                            {trip.destination ?? t('trips.unknownDestination')}
                          {trip.share ? (
                            <span className="badge badge-primary" style={{ marginLeft: 8 }}>
                              {trip.share.public ? t('trips.badges.publicLink') : t('trips.badges.shared')}
                                {!isOwner && (
                                    <>
                                        <strong>{getCreatorName(trip)}</strong>
                                    </>
                                )}
                                {trip.share.mode ? ` (${trip.share.mode})` : ""}
                            </span>
                          ) : isOwner ? (
                            <span className="badge badge-secondary" style={{ marginLeft: 8 }}>
                              {t('trips.badges.createdByYou')}
                            </span>
                          ) : null}
                        </div>

                          <div className="trip-dates" style={{paddingBottom:10}}>
                              <FaCalendar size={18} color="#8a6b80" style={{ marginRight: 8, marginBottom:-3 }} />
                              {formatDateRange(trip.start_date, trip.end_date)}
                          </div>

                          <div className="trip-created">{t('trips.created')} {formatDate(trip.created_at)}</div>
                      </div>

                      <div className="trip-menu-wrapper">
                        <button
                          className="trip-menu-btn"
                          onClick={() => setMenuOpen(menuOpen === trip.id ? null : trip.id)}
                        >
                          ⋮
                        </button>

                        {menuOpen === trip.id && (
                          <div className="trip-menu">
                              {isOwner && <IconButton
                              icon={<FaShare size={20} color="#1E1E1E" />}
                              onClick={() => { openShareModal(trip); setMenuOpen(null); }}
                              variant="menu"
                            />}

                            <IconButton
                              icon={<FaEdit size={18} />}
                              onClick={() => { navigate(`/edit-trip/${trip.id}`); setMenuOpen(null); }}
                              variant="menu"
                            />

                            <IconButton
                              icon={<FaTrash size={18} />}
                              onClick={() => {
                                setDeleteConfirm({ isOpen: true, trip: trip });
                                setMenuOpen(null);
                              }}
                              variant="menu"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}


        <div className="trips-cta">
          <button className="btn-newtrip" onClick={() => navigate("/add-trip")}>
            {t('trips.newTrip')}
          </button>
        </div>

        {/* Modal de compartir */}
        <ShareTripModal
          isOpen={showShareModal}
          onClose={() => {
            setShowShareModal(false);
            setTripToShare(null);
          }}
          trip={tripToShare}
          onShareSuccess={handleShareSuccess}
        />

        {/* Confirmación de eliminación */}
        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          onClose={() => setDeleteConfirm({ isOpen: false, trip: null })}
          onConfirm={async () => {
            if (!deleteConfirm.trip) return;
            try {
                if(Number(user.id)===Number(deleteConfirm.trip.user_id)){
                    await apiDelete(`/trips/${Number(deleteConfirm.trip.id)}`);
                }else{
                    if(deleteConfirm.trip.share) {
                        await apiDelete(`/share/trip/${deleteConfirm.trip.share.share_uuid}/leave`);
                    }
                }
              setTrips((prev) => prev.filter((tripItem) => tripItem.id !== deleteConfirm.trip.id));
            } catch (err) {
              console.error("Error eliminando viaje:", err);
                if(Number(user.id)===Number(deleteConfirm.trip.user_id)){
                    alert(t('trips.delete.error'));
                }else {
                    alert(t('trips.delete.errorAccess'))
                }
            }
          }}
          title={deleteConfirm.trip && Number(user.id)===Number(deleteConfirm.trip.user_id) ? t('trips.delete.title') : t('trips.delete.titleAccess')}
          message={deleteConfirm.trip && Number(user.id)===Number(deleteConfirm.trip.user_id) ? t('trips.delete.confirm', { destination: deleteConfirm.trip?.destination || '' }) : t('trips.delete.confirmAccess', { destination: deleteConfirm.trip?.destination || '' })}
          confirmText={deleteConfirm.trip && Number(user.id)===Number(deleteConfirm.trip.user_id) ? t('trips.delete.confirmButton') : t('trips.delete.confirmAccessButton') }
          variant="primary"
        />
      </main>
    </div>
  );
}
