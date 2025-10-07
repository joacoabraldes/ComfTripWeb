import React, {useState, useMemo, useEffect} from 'react';
import { apiPost, apiGet } from "./api";
import { useNavigate } from 'react-router-dom';
import '../styles/AddTrip.css';
import LogoSvg from '../components/LogoSvg';
import Select from 'react-select';
import Header from "../components/Header";

export default function AddTrip() {
  const [destinations, setDestinations] = useState([
    { city: null, startDate: null, endDate: null }
  ]);
  const [currentDestinationIndex, setCurrentDestinationIndex] = useState(0);
  const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  // new states:
  const [pace, setPace] = useState(""); // 'relajado' | 'moderado' | 'intenso'
  const [placesText, setPlacesText] = useState(""); // comma or newline separated list of places user wants to include
  const [notes, setNotes] = useState("");
  const [budget, setBudget]=useState("");
  const [loadingTrip, setLoadingTrip] = useState(false);
  const nav = useNavigate();
  const [statusMessage, setStatusMessage] = useState(null);
  // Primero obtenemos el destino actual
  const currentDestination = destinations[currentDestinationIndex];

  // Fixed list of allowed cities
  const cityOptions = useMemo(() => ([
    { value: 'barcelona_spain', label: 'Barcelona, Spain', city: 'Barcelona', country: 'Spain' },
    { value: 'buenosaires_argentina', label: 'Buenos Aires, Argentina', city: 'Buenos Aires', country: 'Argentina' },
    { value: 'rome_italy', label: 'Rome, Italy', city: 'Rome', country: 'Italy' },
    { value: 'berlin_germany', label: 'Berlin, Germany', city: 'Berlin', country: 'Germany' },
    { value: 'paris_france', label: 'Paris, France', city: 'Paris', country: 'France' },
  ]), []);

  const normalizeDate=(d)=>{
      if(!d) return new Date();
      const date=d.split("T")[0].split("-");
      const yy = Number(date[0]);
      const mm =Number(date[1])-1;
      const dd = Number(date[2]);
      return new Date(yy, mm, dd);
  }
  const [tripsDates, setTripsDates] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
      let mounted = true;
      (async () => {
          setLoading(true);
          try {
              const res = await apiGet("/trips");
              if (!mounted) return;

              if (Array.isArray(res)) {
                  const sorted = [...res].sort((a, b) => {
                      return normalizeDate(b.start_date) - normalizeDate(a.start_date); // fallback por fecha
                  });
                  const Dates = sorted.map(trip => ({
                      start_date: normalizeDate(trip.start_date),
                      end_date: normalizeDate(trip.end_date)
                  }));
                  setTripsDates(Dates);
              }
          } catch (err) {
              console.error("Error cargando viajes:", err);
          } finally {
              if (mounted) setLoading(false);
          }
      })();
      return () => {
          mounted = false;
      };
  }, []);

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


    const handleDateSelect = (day) => {
    const selectedDate = new Date(currentYear, currentMonth, day);

    if (selectedDate < today || alreadySelected(selectedDate)) {
      return;
    }

    setDestinations((prev) => {
      const newDestinations = [...prev];
      const current = { ...(newDestinations[currentDestinationIndex] || {}) };

      const { startDate, endDate } = current;

      if (!startDate) {
        // primer click -> startDate
        current.startDate = selectedDate;
        current.endDate = null;
      } else if (startDate && !endDate) {
        // segundo click -> endDate (si es anterior, los invertimos)
        const startNorm = startDate;
        if (selectedDate.getTime() < startNorm.getTime()) {
          current.endDate = startNorm;
          current.startDate = selectedDate;
        } else {
          current.endDate = selectedDate;
        }
      } else {
        // ya había un rango: tercer click -> reiniciamos rango empezando por el click
        current.startDate = selectedDate;
        current.endDate = null;
      }

      newDestinations[currentDestinationIndex] = current;
      return newDestinations;
    });
  };

  const isDateInRange = (day) => {
    const current = destinations[currentDestinationIndex];
    if (!current || !current.startDate) return false;

    const currentDate = new Date(currentYear, currentMonth, day);
    const start = current.startDate;

    if (!current.endDate) {
      return start.getTime() === currentDate.getTime();
    }

    const end =current.endDate;
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
        { city: null, startDate: null, endDate: null }
      ];
      setCurrentDestinationIndex(newDest.length - 1);
      return newDest;
    });
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  const handleChangeCity = (val) => {
    setDestinations((prev) => {
      const newDestinations = [...prev];
      newDestinations[currentDestinationIndex] = {
        ...newDestinations[currentDestinationIndex],
        city: val,
      };
      return newDestinations;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoadingTrip(true);
    setStatusMessage(null);

    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null");
      if (!stored || !stored.id) {
        alert("Usuario no identificado. Inicia sesión nuevamente.");
        nav("/login");
        return;
      }

      if (!pace) {
        throw new Error("Selecciona el ritmo del viaje (pace).");
      }

      let createdTripId = null;

      // normalize places text into array
      const placesArray = placesText
        .split(/[,;\n]+/)
        .map(p => p.trim())
        .filter(Boolean);

      for (const dest of destinations) {
        if (!dest.city || !dest.startDate || !dest.endDate) {
          throw new Error("Por favor completa todos los destinos y fechas.");
        }

        const payload = {
          destination: dest.city.label, // e.g. "Barcelona, Spain"
          start_date: dest.startDate,
          end_date: dest.endDate,
          budget: budget || null,
          // keep notes saved on the trip record as metadata
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

        // Send richer payload to itinerary endpoint — this is where LLM notes/pace/places go.
        // Body: { save: true, pace, places, llm_notes, user_id, budget }
        const itineraryBody = {
          save: true,
          pace, // 'relajado' | 'moderado' | 'intenso'
          places: placesArray, // array of place names (may be empty)
          llm_notes: notes || "", // notes meant to be used by the LLM
          user_id: stored.id,
          trip_id: createdTripId,
          budget: budget || null
        };

        // Use POST so backend receives JSON body (change to GET if your backend expects query params)
        await apiPost(`/trips/${createdTripId}/itinerary`, itineraryBody);

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
      setLoadingTrip(false);
      setStatusMessage(null);
    }
  };

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const weekDays = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];

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

  return (
    <div className="add-trip-root">
      <div className="add-trip-container">
        {/* LEFT: Form */}
        <div className="add-trip-left">
          <form className="form" onSubmit={handleSubmit}>
            <label className="field">
              <h2 className="add-trip-subtitle">Selecciona a donde vas a viajar</h2>

              {/* City selector (restricted list) */}
              <Select
                  className="country-select"
                  classNamePrefix="react-select"
                  options={cityOptions}
                  value={currentDestination.city}
                  onChange={handleChangeCity}
                  placeholder="Selecciona una ciudad"
                  isClearable
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
                  const isPast = currentDate < today || alreadySelected(currentDate);

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
                                borderBottomRightRadius: end ? "90px" : "0",
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
                Se armará un plan turístico para {currentDestination.city?.label || ''} del{' '}
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

            <label>Ritmo del viaje (pace)</label>
            <select className="input" value={pace} onChange={(e) => setPace(e.target.value)}>
              <option value="">-- Selecciona ritmo --</option>
              <option value="relajado">Relajado</option>
              <option value="moderado">Moderado</option>
              <option value="intenso">Intenso</option>
            </select>

            <label>Lugares que querés incluir (opcional)</label>
            <textarea
              value={placesText}
              className={"textarea"}
              onChange={(e) => setPlacesText(e.target.value)}
              placeholder="Escribe nombres separados por comas o por línea."
              rows={3}
            />

            <label>Notas del viaje (opcional)</label>
            <textarea value={notes}
                      className={"textarea"}
                      onChange={(e) => setNotes(e.target.value)} rows={3}
                      placeholder="Información que quieras que tenga en cuenta el generador." />

            {statusMessage && <div style={{marginBottom:12, color: "#333"}}>{statusMessage}</div>}

            <button
              type="submit"
              className="btn-primary create-trip"
              disabled={loadingTrip}
              style={{marginBottom: "0"}}
            >
              {loadingTrip ? 'Creando y generando itinerario...' : 'Armar Viaje'}
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
