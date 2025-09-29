import React, { useState, useMemo } from 'react';
import { apiPost, apiGet } from "./api";
import { useNavigate } from 'react-router-dom';
import '../styles/AddTrip.css';
import LogoSvg from '../components/LogoSvg';
import Select from 'react-select';
import countryList from "react-select-country-list";
import { allCountries  } from "country-region-data";

export default function AddTrip() {
  const [destinations, setDestinations] = useState([
    { country: null, province: null, startDate: null, endDate: null }
  ]);
  const [currentDestinationIndex, setCurrentDestinationIndex] = useState(0);
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [notes, setNotes] = useState("");
  const [budget, setBudget]=useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const [statusMessage, setStatusMessage] = useState(null);

  // Primero obtenemos el destino actual
  const currentDestination = destinations[currentDestinationIndex];

  const countries = useMemo(() => countryList().getData(), []);

  // provinces based on country selection
  const provinces = useMemo(() => {
    const country = currentDestination?.country;
    if (!country) return [];
    const countryData = allCountries.find(c => c[0] === country.label);
    if (!countryData) return [];
    return countryData[2].map(r => ({ value: r[1], label: r[0] }));
  }, [currentDestination?.country]);

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

  const handleDateSelect = (day) => {
    const selectedDate = new Date(currentYear, currentMonth, day);
    const normalizedSelected = normalizeDate(selectedDate);

    if (normalizedSelected < normalizeDate(today)) {
      return;
    }

    setDestinations((prev) => {
      const newDestinations = [...prev];
      const current = { ...(newDestinations[currentDestinationIndex] || {}) };

      const { startDate, endDate } = current;

      if (!startDate) {
        // primer click -> startDate
        current.startDate = normalizedSelected;
        current.endDate = null;
      } else if (startDate && !endDate) {
        // segundo click -> endDate (si es anterior, los invertimos)
        const startNorm = normalizeDate(startDate);
        if (normalizedSelected.getTime() < startNorm.getTime()) {
          current.endDate = startNorm;
          current.startDate = normalizedSelected;
        } else {
          current.endDate = normalizedSelected;
        }
      } else {
        // ya había un rango: tercer click -> reiniciamos rango empezando por el click
        current.startDate = normalizedSelected;
        current.endDate = null;
      }

      newDestinations[currentDestinationIndex] = current;
      return newDestinations;
    });
  };

  const isDateInRange = (day) => {
    const current = destinations[currentDestinationIndex];
    if (!current || !current.startDate) return false;

    const currentDate = normalizeDate(new Date(currentYear, currentMonth, day));
    const start = normalizeDate(current.startDate);

    if (!current.endDate) {
      return start.getTime() === currentDate.getTime();
    }

    const end = normalizeDate(current.endDate);
    return currentDate.getTime() >= start.getTime() && currentDate.getTime() <= end.getTime();
  };

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
        setCurrentYear(currentYear+ 1);
        return 0;
      }
      return prev + 1;
    });
  };

  const handleAddDestination = () => {
    setDestinations((prev) => {
      const newDest = [
        ...prev,
        { country: null, province: null, startDate: null, endDate: null }
      ];
      setCurrentDestinationIndex(newDest.length - 1);
      return newDest;
    });
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  const handleChangeCountry = (val) => {
    setDestinations((prev) => {
      const newDestinations = [...prev];
      newDestinations[currentDestinationIndex] = {
        ...newDestinations[currentDestinationIndex],
        country: val,
        province: null,
      };
      return newDestinations;
    });
  };

  const handleChangeProvince = (val) => {
    setDestinations((prev) => {
      const newDestinations = [...prev];
      newDestinations[currentDestinationIndex] = {
        ...newDestinations[currentDestinationIndex],
        province: val,
      };
      return newDestinations;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null");
      if (!stored || !stored.id) {
        alert("Usuario no identificado. Inicia sesión nuevamente.");
        nav("/login");
        return;
      }

      let createdTripId = null;

      for (const dest of destinations) {
        if (!dest.country || !dest.province || !dest.startDate || !dest.endDate) {
          throw new Error("Por favor completa todos los destinos y fechas.");
        }

        const payload = {
          destination: `${dest.province.label}, ${dest.country.label}`,
          start_date: dest.startDate,
          end_date: dest.endDate,
          budget: budget || null,
          notes: notes || null
        };

        setStatusMessage(`Creando viaje a ${payload.destination} ...`);
        const t = await apiPost("/trips", payload);
        if (!t || !t.trip || !t.trip.id) {
          throw new Error("No se pudo crear el viaje");
        }
        createdTripId = t.trip.id;

        // Now ask server to build and persist itinerary for this trip
        setStatusMessage("Generando itinerario automáticamente (esto puede tardar unos segundos) ...");
        // call itinerary endpoint with save=true so server inserts trip_places
        await apiGet(`/trips/${createdTripId}/itinerary?save=true`);
        setStatusMessage("Itinerario generado y guardado!");
      }

      if (createdTripId) {
        // navigate to loading page (you already show a spinner there)
        nav("/load-trip", { state: { tripId: createdTripId } });
      }
    } catch (err) {
      console.error("Error creando viaje:", err);
      alert(err.message || "Ocurrió un error al crear el viaje.");
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const weekDays = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];

  return (
    <div className="add-trip-root">
      <div className="add-trip-container">
        {/* LEFT: Form */}
        <div className="add-trip-left">
          <form className="form" onSubmit={handleSubmit}>
            <label className="field">
              <h2 className="add-trip-subtitle">Selecciona a donde vas a viajar</h2>

              {/* Selector de País */}
              <Select
                  className="country-select"
                  classNamePrefix="react-select"
                  options={countries}
                  value={currentDestination.country}
                  onChange={handleChangeCountry}
                  placeholder="Escribe o selecciona un país"
              />

            </label>
            <label className="field">
              {/* Selector de Región */}
              <Select
                  className="country-select"
                  classNamePrefix="react-select"
                  options={provinces}
                  value={currentDestination.province}
                  onChange={handleChangeProvince}
                  placeholder="Escribe o selecciona una provincia"
                  isDisabled={!currentDestination?.country}
              />
            </label>

            <h2 className="add-trip-subtitle">Selecciona las fechas que vas a estar</h2>

            <div className="calendar-header">
              <span className="month-year">{monthNames[currentMonth]} {currentYear}</span>
              <div className="arrows">
                <button type="button" className="arrow" onClick={handlePrevMonth}>‹</button>
                <button type="button" className="arrow" onClick={handleNextMonth}>›</button>
              </div>
            </div>

            <div className="calendar" >
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
                  const isPast = normalizeDate(currentDate) < normalizeDate(today);

                    const start =
                        currentDestination?.startDate &&
                        currentDestination.startDate.getTime() ===
                        currentDate.getTime();
                    const end =
                        currentDestination?.endDate &&
                        currentDestination.endDate.getTime() ===
                        currentDate.getTime();

                    const inRange = isDateInRange(day.date);

                    return (
                        <button
                            type="button"
                            key={day.date}
                            className={`day ${inRange ? "selected-day" : ""}`}
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

            {currentDestination.startDate && currentDestination.endDate && (
              <p className="date-range">
                Se armará un plan turístico para {currentDestination.province?.label || ''}, {currentDestination.country?.label || ''} del{' '}
                {currentDestination.startDate.getDate()}/{currentDestination.startDate.getMonth() + 1}/
                {currentDestination.startDate.getFullYear()} al{' '}
                {currentDestination.endDate.getDate()}/{currentDestination.endDate.getMonth() + 1}/
                {currentDestination.endDate.getFullYear()}
              </p>
            )}

            <label>Presupuesto (opcional)</label>
            <input value={budget}
                      className={"input"}
                      onChange={(e) => setBudget(e.target.value)} />

            <label>Notas (opcional)</label>
            <textarea value={notes}
                      className={"textarea"}
                      onChange={(e) => setNotes(e.target.value)} rows={3} />

            {statusMessage && <div style={{marginBottom:12, color: "#333"}}>{statusMessage}</div>}

            <button
              type="submit"
              className="btn-primary create-trip"
              disabled={loading}
              style={{marginBottom: "0"}}
            >
              {loading ? 'Creando y generando itinerario...' : 'Armar Viaje'}
            </button>
            <button
                type="button"
                className="btn-secondary add-destination"
                onClick={handleAddDestination}
                style={{marginBottom: "20px"}}
            >
              + Agregar otro destino
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