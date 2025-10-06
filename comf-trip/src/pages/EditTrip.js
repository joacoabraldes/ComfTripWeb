// src/pages/EditTrip.js
import React, { useState, useEffect } from "react";
import { apiPut, apiGet } from "./api";
import { useNavigate, useParams } from "react-router-dom";
import "../styles/AddTrip.css";
import LogoSvg from "../components/LogoSvg";
import Header from "../components/Header";

export default function EditTrip() {
    const { tripId } = useParams(); // 👈 recibimos el ID por la URL
    const [destinations, setDestinations] = useState([
        { destination:"", startDate: null, endDate: null }
    ]);
    const [stored, setStored]=useState(null)
    const currentDestinationIndex = 0;
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [notes, setNotes] = useState("");
    const [budget, setBudget] = useState("");
    const [loading, setLoading] = useState(false);
    const nav = useNavigate();
    const [tripsDates, setTripsDates] = useState([]);
    const [loadingOpen, setLoadingOpen]=useState(true);
    const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

    const currentDestination = destinations[currentDestinationIndex];

    const normalizeDate=(d)=>{
        if(!d) return new Date();
        const date=d.split("T")[0].split("-");
        const yy = Number(date[0]);
        const mm =Number(date[1])-1;
        const dd = Number(date[2]);
        return new Date(yy, mm, dd);
    }

    // cargar datos del trip al montar
    useEffect(() => {
        let mounted=true;
        const fetchTrip = async () => {
            setLoadingOpen(true);
            try {
                const trip = await apiGet(`/trips/${tripId}`);
                const res = await apiGet("/trips");
                if (!mounted) return;
                if(trip){
                    const start = normalizeDate(trip.start_date);
                    setCurrentMonth(start.getMonth());
                    setCurrentYear(start.getFullYear());
                }
                if (Array.isArray(res)) {
                    const sorted = [...res].sort((a, b) => {
                        return normalizeDate(b.start_date) - normalizeDate(a.start_date); // fallback por fecha
                    });
                    const filtered = sorted.filter(t => t.id !== trip.id);
                    const Dates = filtered.map(t => ({
                        start_date: normalizeDate(t.start_date),
                        end_date: normalizeDate(t.end_date)
                    }));
                    setTripsDates(Dates);
                }

                // trip que viene del backend
                setStored(trip);
                setDestinations([
                    {
                        destination: trip.destination,
                        startDate: normalizeDate(trip.start_date),
                        endDate: normalizeDate(trip.end_date)
                    }
                ]);

                setBudget(trip.budget || "");
                setNotes(trip.notes || "");
            } catch (err) {
                console.error("Error cargando trip:", err);
                alert("No se pudo cargar el viaje.");
                nav("/");
            } finally {
                if (mounted) setLoadingOpen(false);
            }
        };
        fetchTrip();return () => { mounted = false; };
    }, [tripId, nav]);

    const getDaysInMonth = (year, month) =>
        new Date(year, month + 1, 0).getDate();

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

    // seleccionar solo endDate
    const handleDateSelect = (day) => {
        const selectedDate = new Date(currentYear, currentMonth, day);

        setDestinations((prev) => {
            const newDestinations = [...prev];
            const current = { ...(newDestinations[currentDestinationIndex] || {}) };
            const start=normalizeDate(stored.start_date);
            const end=normalizeDate(stored.end_date);

                if (selectedDate<end && selectedDate>start) {
                    return newDestinations;
                }
                else if(selectedDate<=start){
                    current.startDate=selectedDate;
                }
                else if (selectedDate>=end){
                    current.endDate = selectedDate;
                }

            newDestinations[currentDestinationIndex] = current;
            return newDestinations;
        });
    };

    const alreadySelected = (d) => {
        if (!d) return false;
        return tripsDates.some(trip => {
            const start = new Date(trip.start_date);
            const end = new Date(trip.end_date);
            if (currentDestination.startDate) {
                if(currentDestination.startDate<start && d>currentDestination.startDate){
                    return d >= start;
                } else if(currentDestination.startDate>end && currentDestination.startDate>d){
                    return d<=end
                }
            }
            return d >= start && d <= end;
        });
    };

    const isDateInRange = (day) => {
        const current = destinations[currentDestinationIndex];
        if (!current || !current.startDate) return false;

        const currentDate = new Date(currentYear, currentMonth, day);
        const start = current.startDate;

        if (!current.endDate) {
            return start === currentDate;
        }

        const end = current.endDate;
        return (
            currentDate >= start &&
            currentDate <= end
        );
    };

    const isDateFormer=(day)=>{
        if(!stored) return false;
        const currentDate = new Date(currentYear, currentMonth, day);
        const start = normalizeDate(stored.start_date);
        if(!stored.end_date) return start===currentDate;
        const end=normalizeDate(stored.end_date);
        return (
            currentDate >= start &&
            currentDate <= end
        );
    }

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
        setLoading(true);

        try {
            const dest = destinations[0];
            if (!dest.startDate || !dest.endDate) {
                throw new Error("Por favor selecciona la fecha de fin del viaje.");
            }

            const payload = {
                id: stored.id,
                user_id: stored.user_id,
                destination: stored.destination,
                start_date: dest.startDate,
                end_date: dest.endDate,
                budget: budget,
                notes: notes,
                created_at: stored.created_at
            };

            await apiPut(`/trips/${tripId}`, payload);
            alert("Viaje actualizado ✅");
            nav("/load-trip", { state: { tripId } });
        } catch (err) {
            console.error("Error editando viaje:", err);
            alert(err.message || "Ocurrió un error al editar el viaje.");
        } finally {
            setLoading(false);
        }
    };

    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo",
        "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    const weekDays = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];

    if (loadingOpen) {
        return (
            <div className="trip-it-root">
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

    return (
        <div className="add-trip-root" >
            <Header/>
            <div className="add-trip-container" >
                {/* LEFT: Form */}
                <div className="add-trip-left">
                    <form className="form" onSubmit={handleSubmit} style={{gap:"10px"}}>
                        <h2 className="add-trip-title" style={{marginBottom:"0"}}>
                            {currentDestination.destination}
                        </h2>

                        <h2 className="add-trip-subtitle">
                            Selecciona la fecha de fin del viaje
                        </h2>

                        <div className="calendar-header">
              <span className="month-year">
                {monthNames[currentMonth]} {currentYear}
              </span>
                            <div className="arrows">
                                <button
                                    type="button"
                                    className="arrow"
                                    onClick={handlePrevMonth}
                                >
                                    ‹
                                </button>
                                <button
                                    type="button"
                                    className="arrow"
                                    onClick={handleNextMonth}
                                >
                                    ›
                                </button>
                            </div>
                        </div>

                        <div className="calendar">
                            <div className="week-days">
                                {weekDays.map((day, index) => (
                                    <span key={index} className="week-day">
                    {day}
                  </span>
                                ))}
                            </div>
                            <div className="days-grid">
                                {Array(firstDayOfMonth)
                                    .fill(null)
                                    .map((_, index) => (
                                        <div key={`empty-${index}`} className="empty-day" />
                                    ))}
                                {days.map((day) => {
                                    const currentDate = new Date(currentYear, currentMonth, day.date);
                                    const isPast = currentDate < today || alreadySelected(currentDate);

                                    const start =
                                        currentDestination?.startDate &&
                                        currentDestination.startDate.getTime() ===
                                        currentDate.getTime();
                                    const end =
                                        currentDestination?.endDate &&
                                        currentDestination.endDate.getTime() ===
                                        currentDate.getTime();

                                    return (
                                        <button
                                            type="button"
                                            key={day.date}
                                            className={`day ${isDateFormer(day.date)? "former-day" : (isDateInRange(day.date) ? "selected-day" : "")}`}
                                            onClick={() =>
                                                !isPast && handleDateSelect(day.date)
                                            }
                                            disabled={isPast}
                                            style={{
                                                borderTopLeftRadius: start ? "90px" : "0",
                                                borderBottomLeftRadius: start ? "90px" : "0",
                                                borderTopRightRadius: end ? "90px" : "0",
                                                borderBottomRightRadius: end ? "90px" : "0"
                                            }}
                                        >
                                            {day.date}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {currentDestination?.startDate && currentDestination?.endDate && (
                            <p className="date-range">
                                Tu viaje a {currentDestination.province?.label},{" "}
                                {currentDestination.country?.label} será del{" "}
                                {currentDestination.startDate.getDate()}/
                                {currentDestination.startDate.getMonth() + 1}/
                                {currentDestination.startDate.getFullYear()} al{" "}
                                {currentDestination.endDate.getDate()}/
                                {currentDestination.endDate.getMonth() + 1}/
                                {currentDestination.endDate.getFullYear()}
                            </p>
                        )}

                        <label>Presupuesto (opcional)</label>
                        <input
                            value={budget}
                            className={"input"}
                            style={{maxHeight:"50px"}}
                            onChange={(e) => setBudget(e.target.value)}
                        />

                        <label>Notas (opcional)</label>
                        <textarea
                            value={notes}
                            className={"textarea"}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                        />

                        <button
                            type="submit"
                            className="btn-primary create-trip"
                            style={{marginBottom:"0"}}
                            disabled={loading}
                        >
                            {loading ? "Guardando..." : "Guardar Cambios"}
                        </button>
                    </form>
                </div>

                {/* RIGHT: Logo */}
                <div className="add-trip-right">
                    <div>
                        <div className="hero-art" aria-hidden>
                            <LogoSvg />
                        </div>
                        <div className="brand">ComfTrip</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
