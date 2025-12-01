// src/pages/EditPlace.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import TimePicker from "../components/TimePicker";
import "../styles/tripItinerary.css";
import "../styles/addPlace.css";
import "../styles/auth.css";
import { apiGet, apiPut } from "./api";
import Map, {Marker, NavigationControl} from "react-map-gl/mapbox";
import { useTranslation } from "../i18n";
import LoadingSpinner from "../components/LoadingSpinner";
const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || "";

export default function EditPlace() {
    const { t } = useTranslation();
    const { tripId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const query = new URLSearchParams(location.search);
    const placeIndex = Number(query.get("placeIndex") ?? 0);

    const [loading, setLoading] = useState(true);
    const [trip, setTrip] = useState(null);
    const [place, setPlace] = useState(null);
    const [date, setDate] = useState("");
    const [startDate, setStartDate]=useState(null);
    const [endDate, setEndDate]=useState(null);
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [startHour, setStartHour] = useState("");
    const [endHour, setEndHour] = useState("");
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [locations, setLocations] = useState([]);
    const [viewState, setViewState] = useState({
        latitude: -34.6037,
        longitude: -58.3816,
        zoom: 11
    });

    const normalizeDate=(d)=>{
        if(!d) return null;
        const date=d.split("T")[0].split("-");
        const yy = Number(date[0]);
        const mm =Number(date[1])-1;
        const dd = Number(date[2]);
        return new Date(yy, mm, dd);
    }
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const tripRes = await apiGet(`/trips/${tripId}`);
                const locs = await apiGet("/locations");
                if (!mounted) return;
                setTrip(tripRes);
                setLocations(Array.isArray(locs) ? locs : []);

                const p = tripRes.places?.[placeIndex];
                if (!p) {
                    setError(t('editPlace.placeNotFound'));
                } else {
                    setPlace(p);
                    setDate(p.date ? p.date.split("T")[0] : "");
                    setStartHour(p.start_hour || "");
                    setEndHour(p.end_hour || "");
                    setNotes(p.notes || "");
                    setViewState({
                        latitude: Number(p.location.latitude),
                        longitude: Number(p.location.longitude),
                        zoom: 16
                    });
                }
                if (tripRes) {
                    setStartDate(normalizeDate(tripRes.start_date));
                    setEndDate(normalizeDate(tripRes.end_date));

                    const start = tripRes.start_date ? new Date(tripRes.start_date) : new Date();
                    setCurrentYear(start.getFullYear());
                    setCurrentMonth(start.getMonth());
                }
            } catch (err) {
                console.error("Error cargando viaje:", err);
                setError(t('editPlace.loadTripError'));
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [tripId, placeIndex]);

    useEffect(() => {
        setStartHour("");
        setEndHour("");
    }, [date]);

    useEffect(() => {
        if(startHour && !startHour.split(":")[1]){
        setEndHour("");}
        else if(startHour && (startHour.split(":")[0]===endHour.split(":")[0] && startHour.split(":")[1]>endHour.split(":")[1])){
            setEndHour(`${endHour.split(":")[0]}:`);
        }
    }, [startHour, endHour]);

    const fmtDate = (d) => {
        if(!d) return "-"
        const date=d.split("T")[0].split("-");
        const yy = date[0];
        const mm =date[1];
        const dd = date[2];
        return `${dd}/${mm}/${yy}`;
    };

    const bookedDates = useMemo(() => new Set(
        (trip?.places || []).map(p => p.date.split("T")[0])
    ), [trip?.places]);

    const occupiedSlots = useMemo(() => {
        if (!trip?.places || !date) return [];
        return trip.places
            .filter(p => p.date.split("T")[0] === date && p !== place)
            .map(p => ({ start: p.start_hour, end: p.end_hour || null }));
    }, [trip?.places, date, place]);

    const nextOccupiedStart = occupiedSlots
        .map(s => s.start)
        .filter(t => t > startHour)
        .sort()[0];

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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!date) {
            alert(t('editPlace.selectDate'));
            return;
        }
        if(!startHour || !endHour){
            alert(t('editPlace.selectStartAndEndTime'));
            return;
        }

        setSaving(true);
        try {
            // reemplazo el lugar editado en el arreglo
            const updatedPlaces = trip.places.map((p, i) => i === placeIndex ? {
                ...p,
                date,
                start_hour: startHour,
                end_hour: endHour,
                notes
            } : p);

            await apiPut(`/trips/${tripId}`, {
                destination: trip.destination,
                start_date: trip.start_date,
                end_date: trip.end_date,
                budget: trip.budget,
                notes: trip.notes,
                places: updatedPlaces.map(p => ({
                    fk_location: p.fk_location ?? p.location?.id,
                    date: p.date,
                    start_hour: p.start_hour,
                    end_hour: p.end_hour,
                    notes: p.notes
                }))
            });

            navigate(`/trip_itinerary/${tripId}`);
        } catch (err) {
            console.error("Error actualizando lugar:", err);
            setError(t('editPlace.saveError'));
        } finally {
            setSaving(false);
        }
    };

    // buscar el location correspondiente
    const locationData = useMemo(() => {
        if (!locations.length) return null;
        const locId = place.location?.id;
        return locations.find(l => Number(l.id) === locId) || null;
    }, [locations, place]);


    if (loading) return(
    <div className="trip-it-root" style={{backgroundColor:"white"}}>
        <LoadingSpinner message={t('editPlace.loading')} />
    </div>
    );
    if (error) return (<div className="trip-it-root">
            <main className="trip-it-main" style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "80vh"
            }}>
                <div style={{ padding: 50, color: "red", fontSize:25 }}>{error}</div>
            </main>
        </div>
    );
    if (!place) return null;

    const monthNames = [
        t('calendar.months.january'),
        t('calendar.months.february'),
        t('calendar.months.march'),
        t('calendar.months.april'),
        t('calendar.months.may'),
        t('calendar.months.june'),
        t('calendar.months.july'),
        t('calendar.months.august'),
        t('calendar.months.september'),
        t('calendar.months.october'),
        t('calendar.months.november'),
        t('calendar.months.december'),
    ];
    const weekDays = [
        t('calendar.weekDays.sunday'),
        t('calendar.weekDays.monday'),
        t('calendar.weekDays.tuesday'),
        t('calendar.weekDays.wednesday'),
        t('calendar.weekDays.thursday'),
        t('calendar.weekDays.friday'),
        t('calendar.weekDays.saturday'),
    ];

    return (
        <div className="trip-it-root">
            <main className="trip-it-main">
                <section className="trip-it-left">
                    <h2 className="trip-it-title">{trip.destination}</h2>
                    <div className="trip-it-dates">
                        {fmtDate(trip.start_date)} — {fmtDate(trip.end_date)}
                    </div>
                    <h3 style={{ marginTop: 18 }}>{t('editPlace.editItineraryPoint')}</h3>
                    <form onSubmit={handleSubmit} className="trip-it-form">
                        <h2 className="trip-it-title">{place.location.titulo}</h2>
                        <div className="trip-it-card">
                        <label>{t('editPlace.date')}</label>

                    <div style={ {borderRadius: "12px", padding:"20px", border: "1px solid #e6e6e6"}}>
                        <div className="calendar-header" style={{paddingBottom:"15px"}}>
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
                    </div></div>
                        <div className="trip-it-card">
                        <label>{t('editPlace.startTime')}</label>
                        <TimePicker
                            value={startHour}
                            onChange={setStartHour}
                            occupiedSlots={occupiedSlots}
                            disabled={!date}/>
                        <label style={{marginTop:15}}>{t('editPlace.endTime')}</label>
                        <TimePicker
                            value={endHour}
                            onChange={setEndHour}
                            occupiedSlots={occupiedSlots}
                            minTime={startHour}   // <--- no permite horas anteriores a startHour
                            maxTime={nextOccupiedStart || null} // null = sin límite superior
                            disabled={!startHour.split(":")[1]}/>
                        </div>

                        <div className="trip-it-card">
                        <label>{t('editPlace.notes')}</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
                        </div>
                        <div style={{ marginTop: 10 }}>
                            <button type="submit" className="btn-primary" disabled={saving}>
                                {saving ? t('editPlace.saving') : t('editPlace.saveChanges')}
                            </button>
                        </div>
                    </form>
                </section>

                <section className="trip-it-right" style={{paddingRight:60}}>
                    <div className="place-detail">
                        <div className="place-it-row">
                            {place.location?.imagenes &&
                            <img
                                src={place.location?.imagenes[0]}
                                className="place-image"
                                alt={t('editPlace.currentPlace')}
                            />}
                            <div className="place-it-info">
                                <h3 style={{fontSize:"50px",marginTop:"5px",  marginBottom:"5px"}}>{place.location?.titulo}</h3>
                                </div></div>
                        {locationData?.descripcion && <p style={{fontSize:"20px", marginTop:"5px", marginBottom:"5px"}}>
                            <strong>{t('editPlace.description')}:</strong> {locationData?.descripcion ?? "-"}
                        </p>}
                        <div style={{ flex: 1, marginTop: 20 }}>
                            <Map
                                {...viewState}
                                onMove={(evt) => setViewState(evt.viewState)}
                                style={{ width: "100%", height: "100%", borderRadius: "10px" }}
                                mapStyle="mapbox://styles/mapbox/streets-v11"
                                mapboxAccessToken={MAPBOX_TOKEN}
                            >
                                <NavigationControl position="top-right" />
                                <Marker
                                    latitude={Number(place.location?.latitude)}
                                    longitude={Number(place.location?.longitude)}
                                    anchor="bottom"
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" style={{ transform: "translate(-12px,-24px)" }}>
                                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ff3951" />
                                        <circle cx="12" cy="9" r="2.5" fill="#fff" />
                                    </svg>
                                </Marker>
                            </Map>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
