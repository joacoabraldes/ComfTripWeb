import React, { useEffect, useState } from "react";
import {useParams, useNavigate, useLocation} from "react-router-dom";
import "../styles/tripItinerary.css";
import TimePicker from "../components/TimePicker"
import "../styles/addPlace.css";
import "../styles/auth.css"
import Select from "react-select";
import { useTranslation } from "../i18n";
import { useSnackbar } from "../contexts/SnackbarContext";
import {normalizeDate} from "../utils/dateUtils";



import { apiGet, apiPost } from "./api";
import Map, {Marker, NavigationControl, Popup} from "react-map-gl/mapbox";
import LoadingSpinner from "../components/LoadingSpinner";
const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || "";

export default function AddPlace() {
    const { t } = useTranslation();
    const { showError, showSuccess } = useSnackbar();
    // NOTE: read the param name that you defined in App.jsx (/:tripId)
    const params = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const tripIdRaw = params.tripId ?? params.id ?? params?.tripId; // tolerate either
    const query = new URLSearchParams(location.search);
    const selectedDate = query.get("date");
    const tripId = Number(tripIdRaw);

    const [loading, setLoading] = useState(true);
    const [trip, setTrip] = useState(null);
    const [locations, setLocations] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState(null); // keep as number or null
    const [locationInfo, setLocationInfo]=useState(null);
    const [date, setDate] =useState(selectedDate);
    const [startDate, setStartDate]=useState(null);
    const [endDate, setEndDate]=useState(null);
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [startHour, setStartHour] = useState("");
    const [endHour, setEndHour] = useState("");
    const [notes, setNotes] = useState("");
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState(null);
    const [viewState, setViewState] = useState({
        latitude: -34.6037,
        longitude: -58.3816,
        zoom: 12
    });
    const [selectedLocationOnMap, setSelectedLocationOnMap] = useState(null);
    const [showAllLocations, setShowAllLocations] = useState(false);


    // --- Helpers to handle different DB field names ---
    const getTripCity = (dest) => {
        if (!dest) return "";
        // take first segment before comma: "Rome, Italy" -> "Rome"
        return dest.toString().split(",")[0].toLowerCase().trim();
    };

    const getLat = (loc) => {
        // tolerate multiple possible field names
        if (!loc) return null;
        return Number(loc.latitude ?? loc.latitud ?? loc.lat ?? loc.lat_lng ?? 0) || null;
    };
    const getLng = (loc) => {
        if (!loc) return null;
        return Number(loc.longitude ?? loc.longitud ?? loc.lng ?? loc.lon ?? 0) || null;
    };
    const getImages = (loc) => {
        if (!loc) return [];
        return loc.imagenes ?? loc.images ?? loc.photos ?? null;
    };

    useEffect(() => {
        let mounted = true;
        (async () => {
            if (!Number.isFinite(tripId) || tripId <= 0) {
                setError(t('addPlace.invalidTripId'));
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);
            try {
                // obtener trip (incluye places según tu controller)
                const tripRes = await apiGet(`/trips/${tripId}`);
                // obtener locations (lista para el dropdown)
                const locs = await apiGet("/locations");

                if (!mounted) return;
                setTrip(tripRes);
                setLocations(Array.isArray(locs) ? locs : []);

                if (tripRes) {
                    setStartDate(normalizeDate(tripRes.start_date));
                    setEndDate(normalizeDate(tripRes.end_date));

                    const start = tripRes.start_date ? new Date(tripRes.start_date) : new Date();
                    setCurrentYear(selectedDate ? normalizeDate(selectedDate).getFullYear() : start.getFullYear());
                    setCurrentMonth(selectedDate ? normalizeDate(selectedDate).getMonth() :  start.getMonth());
                }

            } catch (err) {
                console.error("TripItinerary load error:", err);
                if (err?.status === 401) setError(t('addPlace.notAuthenticated'));
                else if (err?.status === 403) setError(t('addPlace.notAuthorized'));
                else if (err?.status === 404) setError(t('addPlace.tripNotFound'));
                else setError(t('addPlace.loadTripOrLocationsError'));
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [tripId, t, selectedDate]);

    useEffect(() => {
        setStartHour("");
        setEndHour("");
    }, [date]);

    useEffect(() => {
        setEndHour("");
    }, [startHour]);

    useEffect(()=>{
        if(!locationInfo) return;
        const lat = getLat(locationInfo);
        const lng = getLng(locationInfo);
        if (lat && lng) {
            setViewState((v) => ({ ...v, latitude: lat, longitude: lng, zoom: 16 }));
        }
    },[locationInfo])

    // filter locations to only those matching trip.destination (best-effort)
    const filteredLocations = React.useMemo(() => {
        if (!trip || !Array.isArray(locations) || locations.length === 0) return [];
        const tripCity = getTripCity(trip.destination);
        if (!tripCity) return [];

        const cityFields = [
            'city','ciudad','localidad','locality','admin_area','region','province','state','town','municipio'
        ];

        return locations.filter(l => {
            // check common city-like fields
            for (const f of cityFields) {
                const val = (l[f] ?? l[f.toLowerCase()]);
                if (val && val.toString().toLowerCase().includes(tripCity)) return true;
            }
            // also check country if the destination includes country and DB has country column
            if ((l.country || "").toString().toLowerCase().includes(trip.destination?.toString().split(",")[1]?.trim()?.toLowerCase() ?? "")) {
                return true;
            }
            // check descriptive fields
            if (l.address && l.address.toString().toLowerCase().includes(tripCity)) return true;
            if (l.descripcion && l.descripcion.toString().toLowerCase().includes(tripCity)) return true;

            // do NOT implicitly return false when titulo contains city.
            // Titles often contain city names (e.g., "Colosseum, Rome") — but title shouldn't be a primary city-field match.
            // So only match title if none of the other fields exist (optional).
            if ((!l.city && !l.localidad && !l.region && !l.province) && l.titulo && l.titulo.toString().toLowerCase().includes(tripCity)) {
                return true;
            }

            return false;
        });
    }, [trip, locations]);

    const availableLocations = showAllLocations ? locations : filteredLocations;

    const fmtDate = (d) => {
        if(!d) return "-"
        const date=d.split("T")[0].split("-");
        const yy = date[0];
        const mm =date[1];
        const dd = date[2];
        return `${dd}/${mm}/${yy}`;
    };

    const bookedDates = new Set(
        (trip?.places || []).map(p =>
            p.date.split("T")[0] // normalizo a YYYY-MM-DD
        )
    );

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

    let imgs = [];
    if (locationInfo) {
        imgs = safeParseImages(getImages(locationInfo) ?? locationInfo.imagenes);
    }

    // horarios ocupados de la fecha seleccionada
    const occupiedSlots = React.useMemo(() => {
        if (!trip?.places || !date) return [];

        return trip.places
            .filter(p => p.date.split("T")[0] === date) // solo los de la fecha elegida
            .map(p => ({
                start: p.start_hour, // ej: "12:00"
                end: p.end_hour || null // puede que no tenga hora fin
            }));
    }, [trip?.places, date]);

    // calculamos el próximo slot ocupado después de startHour
    const nextOccupiedStart = occupiedSlots
        .map(s => s.start)
        .filter(t => t > startHour)
        .sort()[0]; // primer slot que empieza después de startHour

    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    const weekDays = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];

    const getDaysInMonth = (year, month) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const generateCalendarDays = () => {
        const daysInMonth = getDaysInMonth(currentYear, currentMonth);
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
        const days = [];
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ date: i, selected: false });
        }
        return { days, firstDayOfMonth };
    };

    const { days, firstDayOfMonth } = generateCalendarDays();

    // --- handlePrevMonth / handleNextMonth: NO borres las fechas al navegar ---
    const handlePrevMonth = () => {
        setCurrentMonth((prev) => {
            if (prev === 0) {
                setCurrentYear(currentYear - 1);
                return 11;
            }
            return prev - 1;
        });
    };

    const handleNextMonth = () => {
        setCurrentMonth((prev) => {
            if (prev === 11) {
                setCurrentYear(currentYear + 1);
                return 0;
            }
            return prev + 1;
        });
    };


    async function handleAddPlace(e) {
        e?.preventDefault();
        if (!selectedLocation) {
            showError(t('addPlace.selectLocation'));
            return;
        }
        if (!date) {
            showError(t('addPlace.selectDate'));
            return;
        }
        if(!startHour || !startHour.split(":")[1]){
            showError(t('addPlace.selectStartTime'));
            return;
        }

        if(!endHour || !endHour.split(":")[1]){
            showError(t('addPlace.selectEndTime'));
            return;
        }
        setAdding(true);
        setError(null);
        try {
            const payload = {
                places: [
                    {
                        fk_location: Number(selectedLocation),
                        date,
                        start_hour: startHour || null,
                        end_hour: endHour || null,
                        notes: notes || null,
                    },
                ],
            };
            const res = await apiPost(`/trips/${tripId}/places`, payload);
            const created = res?.places ?? [];
            setTrip((t) => ({
                ...t,
                places: Array.isArray(t?.places) ? [...t.places, ...created] : created,
            }));
            setSelectedLocation(null);
            setStartHour("");
            setEndHour("");
            setNotes("");
            showSuccess(t('addPlace.addPlaceSuccess'));
            navigate(`/trip_itinerary/${tripId}`);
        } catch (err) {
            console.error("Add place error:", err);
            setError(t('addPlace.addPlaceError'));
        } finally {
            setAdding(false);
        }
    }

    // ---------- New: call backend auto-insert endpoint ----------
    async function handleAutoAddPlace(e) {
        e?.preventDefault();
        if (!selectedLocation) {
            showError(t('addPlace.selectLocation'));
            return;
        }
        if (!date) {
            showError(t('addPlace.selectDate'));
            return;
        }

        setAdding(true);
        setError(null);
        try {
            const body = {
                place: {
                    fk_location: Number(selectedLocation),
                    date,
                    start_hour: startHour || null,
                    end_hour: endHour || null,
                    notes: notes || null
                }
            };

            // call the new backend endpoint that uses routing service and inserts/reorders day places
            await apiPost(`/trips/${tripId}/places/auto`, body);

            // backend returns created places for that date; to keep client state consistent we refetch the trip
            const refreshed = await apiGet(`/trips/${tripId}`);
            setTrip(refreshed);

            // reset inputs and navigate back to itinerary view
            setSelectedLocation(null);
            setStartHour("");
            setEndHour("");
            setNotes("");

            showSuccess(t('addPlace.addPlaceSuccess'));
            navigate(`/trip_itinerary/${tripId}`);
        } catch (err) {
            console.error('Auto add error:', err);
            const message = err?.message || (err?.response && err.response?.data && err.response.data.message) || t('addPlace.autoAddError');
            setError(message);
        } finally {
            setAdding(false);
        }
    }

    if (loading) {
        return (
            <div className="trip-it-root" style={{backgroundColor:"white"}}>
                <LoadingSpinner message={t('addPlace.loading')} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="trip-it-root">
                <main className="trip-it-main">
                    <div style={{ padding: 24 }}>
                        <button className="back-link" onClick={() => navigate("/trips")}>{t('addPlace.backToTrips')}</button>
                        <div style={{ marginTop: 18, color: "#b00020" }}>{error}</div>
                    </div>
                </main>
            </div>
        );
    }

    if (!trip) {
        return (
            <div className="trip-it-root">
            </div>
        );
    }

    return (
        <div className="trip-it-root" style={{background: "#fbfbfb"}}>

            <main className="trip-it-main">
                <section className="trip-it-left" >
                    <h2 className="trip-it-title">{trip.destination}</h2>
                    <div className="trip-it-dates">
                        {trip.start_date ? fmtDate(trip.start_date) : "-"} — {trip.end_date ? fmtDate(trip.end_date) : "-"}
                    </div>
                    <h3 style={{ marginTop: 18 }}>{t('addPlace.addPointToItinerary')}</h3>
                    <form onSubmit={handleAddPlace} className="trip-it-form" style={{overflowY: "auto"}}>
                        <div className="trip-it-card">
                            <label>{t('addPlace.location')}</label>
                        <Select
                            className="dropdown-select"
                            classNamePrefix="react-select"
                            options={availableLocations.map(l => {
                                const titulo = l.titulo || l.title || "";
                                const city = l.city || l.ciudad || l.localidad || "";
                                return {
                                    value: Number(l.id),
                                    label: `${titulo}${city ? ` — ${city}` : ""}`,
                                    meta: l
                                };
                            })}
                            value={selectedLocation ? (() => {
                                const loc = locations.find(l => Number(l.id) === Number(selectedLocation));
                                if (!loc) return null;
                                const titulo = loc.titulo || loc.title || "";
                                const city = loc.city || loc.ciudad || loc.localidad || "";
                                return {
                                    value: Number(selectedLocation),
                                    label: `${titulo}${city ? ` — ${city}` : ""}`,
                                    meta: loc
                                };
                            })() : null}
                            onChange={(option) => {
                                if (!option) {
                                    setSelectedLocation(null);
                                    setLocationInfo(null);
                                    return;
                                }
                                const id = Number(option.value);
                                setSelectedLocation(id);
                                const loc = option.meta || locations.find(l => Number(l.id) === id);
                                setLocationInfo(loc || null);
                                if(loc){
                                    const lat = getLat(loc);
                                    const lng = getLng(loc);
                                    if (lat && lng) {
                                        setViewState((v) => ({ ...v, latitude: lat, longitude: lng, zoom: 16 }));
                                    }
                                }
                            }}
                            placeholder={availableLocations.length ? t('addPlace.searchLocation') : t('addPlace.noLocationsFound', { destination: trip.destination })}
                            isDisabled={availableLocations.length === 0}
                            isClearable
                            menuPortalTarget={document.body}
                            menuPosition="fixed"
                            styles={{
                                menuPortal: (base) => ({ ...base, zIndex: 9999 })
                            }}
                            formatOptionLabel={(opt) => {
                                const meta = opt?.meta || {};
                                const city = meta?.city || meta?.ciudad || meta?.localidad || "";
                                const country = meta?.country || meta?.pais || "";
                                return (
                                    <div
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            gap: 8,
                                        }}
                                    >
                                        <div style={{ fontWeight: 700 }}>{opt.label}</div>
                                        <div style={{ color: "#666", fontSize: 12 }}>
                                            {city || country || ""}
                                        </div>
                                    </div>
                                );
                            }}
                        />

                        {/* show an action to reveal all locations when filter returns none */}
                        {filteredLocations.length === 0 && locations.length > 0 && !showAllLocations && (
                            <div style={{ marginTop: 20 }}>
                                <small>{t('addPlace.noMatchingLocations')}</small>
                                <button type="button" className="btn-small" onClick={() => setShowAllLocations(true)} style={{ marginLeft: 8 }}>{t('addPlace.showAll')}</button>
                            </div>
                        )}
                        </div>
                        <div className="trip-it-card">
                        <label>{t('addPlace.date')}</label>

                        <div style={ {borderRadius: "0.75rem", padding:"1.25rem", border: "0.0625rem solid #e6e6e6"}}>
                        <div className="calendar-header" style={{paddingBottom:"0.9375rem"}}>
                            <span className="month-year">{monthNames[currentMonth]} {currentYear}</span>
                            <div className="arrows">
                                <button type="button" className="arrow" onClick={handlePrevMonth}>‹</button>
                                <button type="button" className="arrow" onClick={handleNextMonth}>›</button>
                            </div>
                        </div>
                        <div className="calendar">
                            <div className="week-days">
                                {weekDays.map((day, index) => (
                                    <span key={index} className="week-day">{day}</span>
                                ))}
                            </div>
                            <div className="days-grid">
                                {Array(firstDayOfMonth).fill(null).map((_, index) => (
                                    <div key={`empty-${index}`} className="empty-day" />
                                ))}
                                {days.map((day) => {
                                    const currentDate = new Date(currentYear, currentMonth, day.date);
                                    const isPast = currentDate < startDate || currentDate > endDate;
                                    const isoDate = currentDate.toISOString().split("T")[0];
                                    const occupiedPlace = bookedDates.has(isoDate);

                                    return (
                                        <button
                                            type="button"
                                            key={day.date}
                                            className={`day ${date === isoDate ? (occupiedPlace ? 'selected-occupied-day-it' : 'selected-day-it' ): (occupiedPlace ? 'occupied-day-it' : '')}`}
                                            onClick={() => !isPast && setDate(isoDate)}
                                            disabled={isPast}
                                        >
                                            {day.date}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                        </div>

                        <label style={{paddingTop:"1.25rem"}}>{t('addPlace.startTime')}</label>
                        <TimePicker
                            value={startHour}
                            onChange={setStartHour}
                            occupiedSlots={occupiedSlots}
                            disabled={!date}/>
                        <label style={{paddingTop:"1.25rem"}}>{t('addPlace.endTime')}</label>
                        <TimePicker
                            value={endHour}
                            onChange={setEndHour}
                            occupiedSlots={occupiedSlots}
                            minTime={startHour}   // <--- no permite horas anteriores a startHour
                            maxTime={nextOccupiedStart || null} // null = sin límite superior
                            disabled={!startHour.split(":")[1]}/></div>
                        <div className="trip-it-card">
                        <label>{t('addPlace.notes')}</label>
                        <textarea value={notes}
                                  onChange={(e) => setNotes(e.target.value)} rows={3} /></div>

                        <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
                            <button type="submit" disabled={adding} className="btn-primary">
                                {adding ? t('addPlace.adding') : t('addPlace.addToItinerary')}
                            </button>
                            <button type="button" disabled={adding} onClick={handleAutoAddPlace} className="btn-secondary">
                                {adding ? t('addPlace.processing') : t('addPlace.addAutomatically')}
                            </button>
                        </div>
                        {error && <div className="error">{error}</div>}
                    </form>
                </section>

                <section className="trip-it-right">
                    {!locationInfo ? (
                        <div className="map-wrapper" style={{height: "100%"}}>
                            <Map
                                {...viewState}
                                onMove={(evt) => setViewState(evt.viewState)}
                                style={{ width: "100%", height: "100%", borderRadius: "0.625rem" }}
                                mapStyle="mapbox://styles/mapbox/streets-v11"
                                mapboxAccessToken={MAPBOX_TOKEN}
                            >
                                <div style={{ position: "absolute", right: 10, top: 10, zIndex: 1 }}>
                                    <NavigationControl showCompass showZoom />
                                </div>

                                {availableLocations.map((loc) => {
                                    const lat = getLat(loc);
                                    const lng = getLng(loc);
                                    if (lat == null || lng == null) return null;
                                    return (
                                        <Marker
                                            key={`m-${loc.id}`}
                                            longitude={lng}
                                            latitude={lat}
                                            anchor="bottom"
                                        >
                                            <div
                                                onMouseEnter={() =>
                                                    setSelectedLocationOnMap({
                                                        latitude: lat,
                                                        longitude: lng,
                                                        titulo: loc.titulo,
                                                        interes: loc.fk_interest,
                                                        image: (getImages(loc) && Array.isArray(getImages(loc)) ? getImages(loc)[0] : (getImages(loc) && typeof getImages(loc) === 'string' ? getImages(loc) : null))
                                                    })
                                                }
                                                onMouseLeave={() => setSelectedLocationOnMap(null)}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedLocation(Number(loc.id));
                                                    setLocationInfo(loc);
                                                    setViewState((v) => ({
                                                        ...v,
                                                        latitude: lat,
                                                        longitude: lng,
                                                        zoom: 16
                                                    }));
                                                }}
                                                style={{ cursor: "pointer" }}
                                            >
                                                <svg
                                                    width="24"
                                                    height="24"
                                                    viewBox="0 0 24 24"
                                                    style={{ transform: "translate(-0.75rem,-1.5rem)" }}
                                                    xmlns="http://www.w3.org/2000/svg"
                                                >
                                                    <path
                                                        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                                                        fill="#ff3951"
                                                    />
                                                    <circle cx="12" cy="9" r="2.5" fill="#fff" />
                                                </svg>
                                            </div>
                                        </Marker>
                                    )
                                })}

                                {selectedLocationOnMap && (
                                    <Popup
                                        longitude={Number(selectedLocationOnMap.longitude)}
                                        latitude={Number(selectedLocationOnMap.latitude)}
                                        anchor="bottom"
                                        closeButton={false}
                                        offset={[-12, -53]}
                                    >
                                        <div className="place-popUp">
                                            <img
                                                src={selectedLocationOnMap.image}
                                                className="img-popUp"
                                                alt={t('addPlace.currentPlace')}
                                            />
                                            <div className="place-info">
                                                <h3>{selectedLocationOnMap.titulo}</h3>
                                                {selectedLocationOnMap && (<p>
                                                    {selectedLocationOnMap.interes}
                                                </p>)}
                                            </div>
                                        </div>
                                    </Popup>
                                )}
                            </Map>
                        </div>) : (
                        <div className="place-detail">
                            <div className="place-it-row">
                                <img
                                    src={imgs[0]}
                                    className="place-image"
                                    alt={t('addPlace.currentPlace')}
                                />
                                <div className="place-it-info">
                                    <h3 style={{fontSize:"3.125rem",marginTop:"0.3125rem",  marginBottom:"0.3125rem"}}>{locationInfo.titulo}</h3>
                                    <p style= {{fontSize:"1.25rem",marginTop:"0.3125rem",  marginBottom:"0.3125rem"}}>( {locationInfo.fk_interest} )</p></div></div>
                            <p style= {{fontSize:"1.25rem",marginTop:"0.3125rem",  marginBottom:"0.3125rem"}}><strong>{t('addPlace.description')}: </strong>
                                {locationInfo.descripcion ? locationInfo.descripcion : ""}</p>
                            <div style={{ flex: 1, marginTop: 20 }}>
                                <Map
                                    {...viewState}
                                    onMove={(evt) => setViewState(evt.viewState)}
                                    style={{ width: "100%", height: "100%", borderRadius: "0.625rem" }}
                                    mapStyle="mapbox://styles/mapbox/streets-v11"
                                    mapboxAccessToken={MAPBOX_TOKEN}
                                >
                                    <NavigationControl position="top-right" />
                                    {availableLocations.map((loc) => {
                                        const lat = getLat(loc);
                                        const lng = getLng(loc);
                                        if (lat == null || lng == null) return null;
                                        return (
                                            <Marker
                                                key={`m-${loc.id}`}
                                                longitude={lng}
                                                latitude={lat}
                                                anchor="bottom"
                                            >
                                                <div
                                                    onMouseEnter={() =>
                                                        setSelectedLocationOnMap({
                                                            latitude: lat,
                                                            longitude: lng,
                                                            titulo: loc.titulo,
                                                            interes:loc.fk_interest,
                                                            image:(getImages(loc) && Array.isArray(getImages(loc)) ? getImages(loc)[0] : getImages(loc))
                                                        })
                                                    }
                                                    onMouseLeave={() => setSelectedLocationOnMap(null)}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedLocation(Number(loc.id));
                                                        setLocationInfo(loc);
                                                        setViewState((v) => ({
                                                            ...v,
                                                            latitude: lat,
                                                            longitude: lng,
                                                            zoom: 16
                                                        }));
                                                    }}
                                                    style={{ cursor: "pointer" }}
                                                >
                                                    <svg
                                                        width="24"
                                                        height="24"
                                                        viewBox="0 0 24 24"
                                                        style={{ transform: "translate(-0.75rem,-1.5rem)" }}
                                                        xmlns="http://www.w3.org/2000/svg"
                                                    >
                                                        <path
                                                            d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                                                            fill="#ff3951"
                                                        />
                                                        <circle cx="12" cy="9" r="2.5" fill="#fff" />
                                                    </svg>
                                                </div>
                                            </Marker>
                                        )
                                    })}

                                    {selectedLocationOnMap && (
                                        <Popup
                                            longitude={Number(selectedLocationOnMap.longitude)}
                                            latitude={Number(selectedLocationOnMap.latitude)}
                                            anchor="bottom"
                                            closeButton={false}
                                            offset={[-12, -53]}
                                        >
                                            <div className="place-popUp">
                                                <img
                                                    src={selectedLocationOnMap.image}
                                                    className="img-popUp"
                                                    alt={t('addPlace.currentPlace')}
                                                />
                                                <div className="place-info">
                                                    <h3>{selectedLocationOnMap.titulo}</h3>
                                                    {selectedLocationOnMap && (<p>
                                                        {selectedLocationOnMap.interes}
                                                    </p>)}
                                                </div>
                                            </div>
                                        </Popup>
                                    )}
                                </Map>
                            </div>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
