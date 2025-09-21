// src/pages/TripItinerary.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import MapSvg from "../components/MapSvg";
import "../styles/tripItinerary.css";
import Header from "../components/Header";
import TimePicker from "../components/TimePicker"
import "../styles/addPlace.css";
import "../styles/auth.css"
import Select from "react-select";

import { apiGet, apiPost } from "./api"; // tus helpers

// const API_BASE = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "");
//
// function getAuthToken() {
//     return (
//         localStorage.getItem("token") ||
//         (() => {
//             try {
//                 const u = JSON.parse(localStorage.getItem("user") || "null");
//                 return u?.token || null;
//             } catch (e) {
//                 return null;
//             }
//         })()
//     );
// }

export default function AddPlace() {
    // NOTE: read the param name that you defined in App.jsx (/:tripId)
    const params = useParams();
    const navigate = useNavigate();
    const tripIdRaw = params.tripId ?? params.id ?? params?.tripId; // tolerate either
    const tripId = Number(tripIdRaw);

    const [loading, setLoading] = useState(true);
    const [trip, setTrip] = useState(null);
    const [locations, setLocations] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState("");
    const [locationInfo, setLocationInfo]=useState(null);
    const [date, setDate] =useState("");
    const [startDate, setStartDate]=useState(null);
    const [endDate, setEndDate]=useState(null);
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [startHour, setStartHour] = useState("");
    const [endHour, setEndHour] = useState("");
    const [notes, setNotes] = useState("");
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            if (!Number.isFinite(tripId) || tripId <= 0) {
                setError("ID de viaje inválido en la URL.");
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
                    setStartDate(tripRes.start_date ? new Date(tripRes.start_date) : null);
                    setEndDate(tripRes.end_date ? new Date(tripRes.end_date) : null);

                    const start = tripRes.start_date ? new Date(tripRes.start_date) : new Date();
                    setCurrentYear(start.getFullYear());
                    setCurrentMonth(start.getMonth());
                }

            } catch (err) {
                console.error("TripItinerary load error:", err);
                // intenta mostrar info útil si el helper apiGet devuelve un objeto con status
                if (err?.status === 401) setError("No autenticado. Por favor inicie sesión.");
                else if (err?.status === 403) setError("No autorizado para ver ese viaje.");
                else if (err?.status === 404) setError("Viaje no encontrado (compruebe ownership o id).");
                else setError("No se pudo cargar el viaje o las localidades.");
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [tripId]);

    useEffect(() => {
        setStartHour("");
        setEndHour("");
    }, [date]);

    useEffect(() => {
        setEndHour("");
    }, [startHour]);

    const bookedDates = new Set(
        (trip?.places || []).map(p =>
            p.date.split("T")[0] // normalizo a YYYY-MM-DD
        )
    );

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

    const normalizeDate = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());


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
            alert("Seleccione una ubicación.");
            return;
        }
        if (!date) {
            alert("Seleccione una fecha.");
            return;
        }
        if(!startHour || !startHour.split(":")[1]){
            alert("Seleccione hora de inicio");
            return;
        }

        if(!endHour || !endHour.split(":")[1]){
            alert("Seleccione hora de final");
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
            setSelectedLocation("");
            setStartHour("");
            setEndHour("");
            setNotes("");
            navigate(`/trip_itinerary/${tripId}`);
        } catch (err) {
            console.error("Add place error:", err);
            setError("No se pudo añadir el lugar. Intente nuevamente.");
        } finally {
            setAdding(false);
        }
    }

    if (loading) {
        return (
            <div className="trip-it-root">
                <Header/>
                <main className="trip-it-main" style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "80vh" // ocupa casi toda la pantalla
                }}>
                    <div style={{fontSize:25}}> Cargando… </div>
                </main>
            </div>
        );
    }

    if (error) {
        return (
            <div className="trip-it-root">
                <Header/>
                <main className="trip-it-main">
                    <div style={{ padding: 24 }}>
                        <button className="back-link" onClick={() => navigate("/trips")}>← Volver a viajes</button>
                        <div style={{ marginTop: 18, color: "#b00020" }}>{error}</div>
                    </div>
                </main>
            </div>
        );
    }

    if (!trip) {
        return (
            <div className="trip-it-root">
                <Header/>
            </div>
        );
    }

    return (
        <div className="trip-it-root">
            <Header/>

            <main className="trip-it-main">
                <section className="trip-it-left" >

                    <h2 className="trip-it-title">{trip.destination}</h2>
                    <div className="trip-it-dates">
                        {trip.start_date ? new Date(trip.start_date).toLocaleDateString() : "-"} — {trip.end_date ? new Date(trip.end_date).toLocaleDateString() : "-"}
                    </div>
                    <h3 style={{ marginTop: 18 }}>Agregar punto al itinerario</h3>
                    <form onSubmit={handleAddPlace} className="trip-it-form" style={{overflowY: "auto"}}>
                        <label>Ubicación</label>
                        <Select
                            className="country-select"
                            classNamePrefix="react-select"
                            options={locations.map(l => ({
                                value: l.id,
                                label: `${l.titulo} (${l.fk_interest})`
                            }))}
                            value={selectedLocation ? {
                                value: selectedLocation,
                                label: `${locations.find(l => l.id == selectedLocation)?.titulo || ""}`
                            } : ""}
                            onChange={(option) => {
                                setSelectedLocation(option.value);
                                const loc = locations.find(l => l.id === option.value);
                                setLocationInfo(loc || "");
                            }}
                            placeholder="Buscar ubicación..."
                        />

                        <label>Fecha</label>

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
                                    const isPast = normalizeDate(currentDate) < normalizeDate(startDate) || normalizeDate(currentDate) > normalizeDate(endDate);
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

                        <label >Hora inicio</label>
                        <TimePicker
                            value={startHour}
                            onChange={setStartHour}
                            occupiedSlots={occupiedSlots}
                            disabled={!date}/>
                        <label>Hora fin</label>
                        <TimePicker
                            value={endHour}
                            onChange={setEndHour}
                            occupiedSlots={occupiedSlots}
                            minTime={startHour}   // <--- no permite horas anteriores a startHour
                            maxTime={nextOccupiedStart || null} // null = sin límite superior
                            disabled={!startHour.split(":")[1]}/>
                        <label>Notas (opcional)</label>
                        <textarea value={notes}
                                  style={{background: "#fcf7f7", border: "1px solid #e8d1d1"}}
                                  onChange={(e) => setNotes(e.target.value)} rows={3} />

                        <div style={{ marginTop: 10 }}>
                            <button type="submit" disabled={adding} className="btn-primary">
                                {adding ? "Agregando…" : "Agregar al itinerario"}
                            </button>
                        </div>
                        {error && <div className="error">{error}</div>}
                    </form>
                </section>

                <section className="trip-it-right">
                    {!locationInfo ? (
                    <div className="map-wrapper">
                        <MapSvg width={999} height={800} />
                    </div>) : (
                        <div className="place-detail">
                            <h3 style={{fontSize:"50px",marginTop:"5px",  marginBottom:"5px"}}>{locationInfo.titulo}</h3>
                            <p style= {{fontSize:"20px",marginTop:"5px",  marginBottom:"5px"}}>({locationInfo.fk_interest})</p>
                            <p style= {{fontSize:"20px",marginTop:"5px",  marginBottom:"5px"}}><strong>Descripcion:</strong>
                                {locationInfo.description ? `${locationInfo.description}` : '-'}</p>

                            {/* Imágenes */}
                            {locationInfo.images && locationInfo.images.length > 0 && (
                                <div style={{marginTop:"20px"}}><strong style={{fontSize:"20px",marginTop:"30px", marginBottom:"5px"}}>Imagenes</strong>
                                    <div className="place-images">
                                        {locationInfo.images.map((imgUrl, i) => (
                                            <img key={i} src={imgUrl} alt={`Lugar ${i + 1}`} className="place-image"/>
                                        ))}
                                    </div></div>
                            )}
                            <div style={{marginTop:"20px"}}><strong style={{fontSize:"20px",marginTop:"30px", marginBottom:"5px"}}>Mapa</strong></div>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}