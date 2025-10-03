// src/pages/EditPlace.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import MapSvg from "../components/MapSvg";
import TimePicker from "../components/TimePicker";
import "../styles/tripItinerary.css";
import "../styles/addPlace.css";
import "../styles/auth.css";
import { apiGet, apiPut } from "./api";
import Header from "../components/Header";

export default function EditPlace() {
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
                    setError("Lugar no encontrado");
                } else {
                    setPlace(p);
                    setDate(p.date ? p.date.split("T")[0] : "");
                    setStartHour(p.start_hour || "");
                    setEndHour(p.end_hour || "");
                    setNotes(p.notes || "");
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
                setError("No se pudo cargar el viaje");
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
            alert("Seleccione una fecha.");
            return;
        }
        if(!startHour || !endHour){
            alert("Seleccione hora inicio y fin.");
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
            setError("No se pudo guardar los cambios.");
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
    <div className="trip-it-root">
                <main className="trip-it-main" style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "80vh"
                }}>
                    <div style={{fontSize:25}}> Cargando… </div>
                </main>
            </div>
        );
    if (error) return (<div className="trip-it-root">
            <Header/>
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
        'Enero','Febrero','Marzo','Abril','Mayo','Junio',
        'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
    ];
    const weekDays = ['DOM','LUN','MAR','MIE','JUE','VIE','SAB'];

    return (
        <div className="trip-it-root">
            <Header />
            <main className="trip-it-main">
                <section className="trip-it-left">
                    <h2 className="trip-it-title">{trip.destination}</h2>
                    <div className="trip-it-dates">
                        {fmtDate(trip.start_date)} — {fmtDate(trip.end_date)}
                    </div>
                    <h3 style={{ marginTop: 18 }}>Editar punto del itinerario</h3>
                    <form onSubmit={handleSubmit} className="trip-it-form">
                        <h2 className="trip-it-title">{place.location.titulo}</h2>
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

                        <label>Hora inicio</label>
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

                        <label>Notas</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />

                        <div style={{ marginTop: 10 }}>
                            <button type="submit" className="btn-primary" disabled={saving}>
                                {saving ? "Guardando…" : "Guardar cambios"}
                            </button>
                        </div>
                    </form>
                </section>

                <section className="trip-it-right">
                    <div className="place-detail">
                        <h3 style={{fontSize:"50px", marginTop:"5px", marginBottom:"5px"}}>{place.location?.titulo ?? `Lugar #${place.fk_location}`}</h3>
                        <p style={{fontSize:"20px", marginTop:"5px", marginBottom:"5px"}}>({place.location?.fk_interest ?? "-"})</p>
                        <p style={{fontSize:"20px", marginTop:"5px", marginBottom:"5px"}}>
                            <strong>Descripcion:</strong> {locationData?.descripcion ?? "-"}
                        </p>


                        {place.location?.imagenes && place.location?.imagenes.length > 0 && (
                            <div style={{marginTop:"20px"}}>
                                <strong style={{fontSize:"20px", marginTop:"30px", marginBottom:"5px"}}>Imagenes</strong>
                                <div className="place-images">
                                    {place.location?.imagenes.map((imgUrl, i) => (
                                        <img key={i} src={imgUrl} alt={`Lugar ${i+1}`} className="place-image"/>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div style={{marginTop:"20px"}}><strong style={{fontSize:"20px", marginTop:"30px", marginBottom:"5px"}}>Mapa</strong></div>
                    </div>
                </section>
            </main>
        </div>
    );
}
