// src/pages/AddTrip.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/AddTrip.css';
import LogoSvg from '../components/LogoSvg';

export default function AddTrip() {
  const [destinations, setDestinations] = useState([{ destination: null, startDate: null, endDate: null }]);
  const [currentDestinationIndex, setCurrentDestinationIndex] = useState(0);
  const [currentMonth, setCurrentMonth] = useState(8); // Septiembre 2025
  const [currentYear, setCurrentYear] = useState(2025);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

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

  const handleDateSelect = (day) => {
    const selectedDate = new Date(currentYear, currentMonth, day);
    setDestinations((prev) => {
      const newDestinations = [...prev];
      const current = newDestinations[currentDestinationIndex];
      if (!current.startDate || (current.startDate && current.endDate)) {
        current.startDate = selectedDate;
        current.endDate = null;
      } else {
        if (selectedDate < current.startDate) {
          current.startDate = selectedDate;
          current.endDate = current.startDate;
        } else {
          current.endDate = selectedDate;
        }
      }
      return newDestinations;
    });
  };

  const isDateInRange = (day) => {
    const current = destinations[currentDestinationIndex];
    const { startDate, endDate } = current;
    if (!startDate) return false;
    if (!endDate) return startDate.getDate() === day && startDate.getMonth() === currentMonth && startDate.getFullYear() === currentYear;
    const currentDate = new Date(currentYear, currentMonth, day);
    return currentDate >= startDate && currentDate <= endDate;
  };

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => {
      if (prev === 0) {
        setCurrentYear((year) => year - 1);
        return 11;
      }
      return prev - 1;
    });
    setDestinations((prev) => {
      const newDestinations = [...prev];
      newDestinations[currentDestinationIndex] = {
        ...newDestinations[currentDestinationIndex],
        startDate: null,
        endDate: null,
      };
      return newDestinations;
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => {
      if (prev === 11) {
        setCurrentYear((year) => year + 1);
        return 0;
      }
      return prev + 1;
    });
    setDestinations((prev) => {
      const newDestinations = [...prev];
      newDestinations[currentDestinationIndex] = {
        ...newDestinations[currentDestinationIndex],
        startDate: null,
        endDate: null,
      };
      return newDestinations;
    });
  };

  const handleDestinationChange = (e) => {
    const text = e.target.value;
    setDestinations((prev) => {
      const newDestinations = [...prev];
      newDestinations[currentDestinationIndex] = { ...newDestinations[currentDestinationIndex], destination: text };
      return newDestinations;
    });
  };

  const handleAddDestination = () => {
    setDestinations((prev) => [
      ...prev,
      { destination: '', startDate: null, endDate: null },
    ]);
    setCurrentDestinationIndex(destinations.length);
    setCurrentMonth(9);
    setCurrentYear(2025);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      for (const dest of destinations) {
        if (!dest.destination || !dest.startDate || !dest.endDate) {
          throw new Error('Por favor completa todos los destinos y fechas.');
        }
      }
      // TODO: API call para crear el viaje
      console.log('Trip data:', destinations);
      nav('/load-trip', { state: { tripData: destinations } });
    } catch (err) {
      alert(err.message || 'Ocurrió un error al crear el viaje.');
    } finally {
      setLoading(false);
    }
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const weekDays = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];

  const currentDestination = destinations[currentDestinationIndex];

  return (
    <div className="add-trip-root">
      <div className="add-trip-container">
        {/* LEFT: Form */}
        <div className="add-trip-left">
          <form className="form" onSubmit={handleSubmit}>
            <label className="field">
              <h2 className="add-trip-subtitle">Selecciona a donde vas a viajar</h2>
              <input
                className="input"
                value={currentDestination.destination}
                onChange={handleDestinationChange}
                placeholder="Destino"
                required
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
                {days.map((day) => (
                  <button
                    type="button"
                    key={day.date}
                    className={`day ${isDateInRange(day.date) ? 'selected-day' : ''}`}
                    onClick={() => handleDateSelect(day.date)}
                  >
                    {day.date}
                  </button>
                ))}
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