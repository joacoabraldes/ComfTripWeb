// src/pages/AddTrip.js
import React, { useState, useMemo } from 'react';
import { apiPost } from "./api";
import { useNavigate } from 'react-router-dom';
import '../styles/AddTrip.css';
import LogoSvg from '../components/LogoSvg';
import Select from 'react-select';
import countryList from "react-select-country-list";
import { allCountries  } from "country-region-data";

export default function AddTrip() {
  const [destinations, setDestinations] = useState([
    { country: null, region: null, startDate: null, endDate: null }
  ]);
  const [currentDestinationIndex, setCurrentDestinationIndex] = useState(0);
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  // Primero obtenemos el destino actual
  const currentDestination = destinations[currentDestinationIndex];

  const countries = useMemo(() => countryList().getData(), []);

// Luego lo usamos en regions
  const regions = useMemo(() => {
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

// Normaliza una fecha para que comparemos solo día/mes/año (sin horas)
  const normalizeDate = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// --- handleDateSelect: lógica de rango robusta ---
  const handleDateSelect = (day) => {
    const selectedDate = new Date(currentYear, currentMonth, day);
    const normalizedSelected = normalizeDate(selectedDate);

    //  no dejar seleccionar si es antes de hoy
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

// --- isDateInRange: marca correctamente los días entre start y end ---
  const isDateInRange = (day) => {
    const current = destinations[currentDestinationIndex];
    if (!current || !current.startDate) return false;

    const currentDate = normalizeDate(new Date(currentYear, currentMonth, day));
    const start = normalizeDate(current.startDate);

    if (!current.endDate) {
      // Si no hay endDate, solo marcar el startDate
      return start.getTime() === currentDate.getTime();
    }

    const end = normalizeDate(current.endDate);
    return currentDate.getTime() >= start.getTime() && currentDate.getTime() <= end.getTime();
  };

// --- handlePrevMonth / handleNextMonth: NO borres las fechas al navegar ---
  const handlePrevMonth = () => {
    setCurrentMonth((prev) => {
      if (prev === 0) {
        setCurrentYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => {
      if (prev === 11) {
        setCurrentYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  };

// --- handleAddDestination: asegurar que el índice nuevo sea correcto ---
  const handleAddDestination = () => {
    setDestinations((prev) => {
      const newDest = [
        ...prev,
        { country: null, region: null, startDate: null, endDate: null }
      ];
      // ponemos el índice en la nueva última posición
      setCurrentDestinationIndex(newDest.length - 1);
      return newDest;
    });
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };


  const handleDestinationChange = (e) => {
    const text = e.target.value;
    setDestinations((prev) => {
      const newDestinations = [...prev];
      newDestinations[currentDestinationIndex] = { ...newDestinations[currentDestinationIndex], destination: text };
      return newDestinations;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null");
      if (!stored || !stored.id) {
        alert("Usuario no identificado. Inicia sesión nuevamente.");
        nav("/login");
        return;
      }

      for (const dest of destinations) {
        if (!dest.country || !dest.region || !dest.startDate || !dest.endDate) {
          throw new Error("Por favor completa todos los destinos y fechas.");
        }

        // 👇 armar el payload que espera tu backend
        const payload = {
          destination: `${dest.region.label}, ${dest.country.label}`,
          start_date: dest.startDate,
          end_date: dest.endDate,
          budget: null,
          notes: "",
        };

        await apiPost("/trips", payload);
      }

      alert("Viaje creado correctamente 🎉");
      nav("/load-trip", { state: { tripData: destinations } });
    } catch (err) {
      console.error("Error creando viaje:", err);
      alert(err.message || "Ocurrió un error al crear el viaje.");
    } finally {
      setLoading(false);
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
              {/* Selector de País */}
              <Select
                  className="country-select"
                  classNamePrefix="react-select"
                  options={countries}
                  value={currentDestination.country}
                  onChange={(val) => {
                    setDestinations((prev) => {
                      const newDestinations = [...prev];
                      newDestinations[currentDestinationIndex] = {
                        ...newDestinations[currentDestinationIndex],
                        country: val,
                        region: null, // al cambiar país, se resetea región
                      };
                      return newDestinations;
                    });
                  }}
                  placeholder="Escribe o selecciona un país"
                  isClearable
              />

            </label>
            <label className="field">
              {/* Selector de Región */}
              <Select
                  className="country-select"
                  classNamePrefix="react-select"
                  options={regions}
                  value={currentDestination.region}
                  onChange={(val) => {
                    setDestinations((prev) => {
                      const newDestinations = [...prev];
                      newDestinations[currentDestinationIndex] = {
                        ...newDestinations[currentDestinationIndex],
                        region: val,
                      };
                      return newDestinations;
                    });
                  }}
                  placeholder="Escribe o selecciona una región"
                  isClearable
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
                  const isPast = normalizeDate(currentDate) < normalizeDate(today);

                  return (
                      <button
                          type="button"
                          key={day.date}
                          className={`day ${isDateInRange(day.date) ? 'selected-day' : ''}`}
                          onClick={() => !isPast && handleDateSelect(day.date)}
                          disabled={isPast}
                      >
                        {day.date}
                      </button>
                  )
                })}
              </div>
            </div>

            {currentDestination.startDate && currentDestination.endDate && (
              <p className="date-range">
                Se armará un plan turístico para {currentDestination.destination} del{' '}
                {currentDestination.startDate.getDate()}/{currentDestination.startDate.getMonth() + 1}/
                {currentDestination.startDate.getFullYear()} al{' '}
                {currentDestination.endDate.getDate()}/{currentDestination.endDate.getMonth() + 1}/
                {currentDestination.endDate.getFullYear()}
              </p>
            )}

            <button
              type="submit"
              className="btn-primary create-trip"
              disabled={loading}
            >
              {loading ? 'Creando...' : 'Armar Viaje'}
            </button>
          </form>

          <button
            type="button"
            className="btn-secondary add-destination"
            onClick={handleAddDestination}
          >
            + Agregar otro destino
          </button>
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