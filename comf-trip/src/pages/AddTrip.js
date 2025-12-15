// src/pages/AddTrip.jsx
import React, { useState, useMemo, useEffect } from "react";
import { apiPost, apiGet } from "./api";
import { useNavigate } from "react-router-dom";
import "../styles/AddTrip.css";
import LogoSvg from "../components/LogoSvg";
import Select from "react-select";
import { useTranslation } from "../i18n";
import { useSnackbar } from "../contexts/SnackbarContext";
import LoadingSpinner from "../components/LoadingSpinner";
import LoadTrip from "./LoadTrip";
import { normalizeDate } from "../utils/dateUtils";
import FlightFinder from "../components/FlightFinder";

export default function AddTrip() {
  const { t } = useTranslation();
  const { showError } = useSnackbar();

  const [destinations, setDestinations] = useState([
    {
      city: null,
      startDate: null,
      endDate: null,
      originCountry: null,
      originCity: null,
      originAirport: null,
      destinationAirport: null,
      flightOffers: [],
      offersLoading: false,
      selectedFlight: null,
    },
  ]);

  const [currentDestinationIndex, setCurrentDestinationIndex] = useState(0);
  const today = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate()
  );
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  // preferences
  const [pace, setPace] = useState("");
  const [placesText, setPlacesText] = useState("");
  const [notes, setNotes] = useState("");
  const [loadingTrip, setLoadingTrip] = useState(false);
  const nav = useNavigate();
  const [statusMessage, setStatusMessage] = useState(null);
  const [tripsDates, setTripsDates] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentDestination = destinations[currentDestinationIndex];

  const cityOptions = useMemo(
    () => [
      {
        value: "barcelona_spain",
        label: "Barcelona, España",
        city: "Barcelona",
        country: "Spain",
        countryCode: "ES",
      },
      {
        value: "buenosaires_argentina",
        label: "Buenos Aires, Argentina",
        city: "Buenos Aires",
        country: "Argentina",
        countryCode: "AR",
      },
      {
        value: "rome_italy",
        label: "Roma, Italia",
        city: "Rome",
        country: "Italy",
        countryCode: "IT",
      },
      {
        value: "berlin_germany",
        label: "Berlín, Alemania",
        city: "Berlin",
        country: "Germany",
        countryCode: "DE",
      },
      {
        value: "paris_france",
        label: "París, Francia",
        city: "Paris",
        country: "France",
        countryCode: "FR",
      },
    ],
    []
  );

  // Load existing trips to mark already-selected dates
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await apiGet("/trips");
        if (!mounted) return;
        if (Array.isArray(res)) {
          const sorted = [...res].sort(
            (a, b) => normalizeDate(b.start_date) - normalizeDate(a.start_date)
          );
          const Dates = sorted.map((trip) => ({
            start_date: normalizeDate(trip.start_date),
            end_date: normalizeDate(trip.end_date),
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

  const getDaysInMonth = (year, month) =>
    new Date(year, month + 1, 0).getDate();

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const days = [];
    for (let i = 1; i <= daysInMonth; i++)
      days.push({ date: i, selected: false });
    return { days, firstDayOfMonth };
  };

  const { days, firstDayOfMonth } = generateCalendarDays();

  const alreadySelected = (d) => {
    if (!d) return false;
    return tripsDates.some((trip) => {
      const start = new Date(trip.start_date);
      const end = new Date(trip.end_date);
      if (currentDestination.startDate) {
        if (
          currentDestination.startDate < start &&
          d > currentDestination.startDate
        )
          return d >= start;
        else if (
          currentDestination.startDate > end &&
          currentDestination.startDate > d
        )
          return d <= end;
      }
      return d >= start && d <= end;
    });
  };

  const handleDateSelect = (day) => {
    const selectedDate = new Date(currentYear, currentMonth, day);
    if (selectedDate < today || alreadySelected(selectedDate)) return;

    setDestinations((prev) => {
      const newDest = [...prev];
      const current = { ...(newDest[currentDestinationIndex] || {}) };
      const { startDate, endDate } = current;

      if (!startDate) {
        current.startDate = selectedDate;
        current.endDate = null;
      } else if (startDate && !endDate) {
        if (selectedDate.getTime() < startDate.getTime()) {
          current.endDate = startDate;
          current.startDate = selectedDate;
        } else {
          current.endDate = selectedDate;
        }
      } else {
        current.startDate = selectedDate;
        current.endDate = null;
      }

      newDest[currentDestinationIndex] = current;
      return newDest;
    });
  };

  const isDateInRange = (day) => {
    const current = destinations[currentDestinationIndex];
    if (!current || !current.startDate) return false;
    const currentDate = new Date(currentYear, currentMonth, day);
    const start = current.startDate;
    if (!current.endDate) return false;
    const end = current.endDate;
    return (
      currentDate.getTime() > start.getTime() &&
      currentDate.getTime() < end.getTime()
    );
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
        setCurrentYear(currentYear + 1);
        return 0;
      }
      return prev + 1;
    });
  };

  const handleAddDestination = () => {
    setDestinations((prev) => {
      const newDest = [
        ...prev,
        {
          city: null,
          startDate: null,
          endDate: null,
          originCountry: null,
          originCity: null,
          originAirport: null,
          destinationAirport: null,
          flightOffers: [],
          offersLoading: false,
          selectedFlight: null,
        },
      ];
      setCurrentDestinationIndex(newDest.length - 1);
      return newDest;
    });
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  const handleChangeDestinationCity = (val) => {
    setDestinations((prev) => {
      const copy = [...prev];
      copy[currentDestinationIndex] = {
        ...(copy[currentDestinationIndex] || {}),
        city: val,
        destinationAirport: null,
        flightOffers: [],
        selectedFlight: null,
      };
      return copy;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoadingTrip(true);
    setStatusMessage(null);

    try {
      const stored = JSON.parse(localStorage.getItem("user") || "null");
      if (!stored || !stored.id) {
        showError(t("addTrip.userNotIdentified"));
        nav("/login");
        return;
      }

      if (!pace) throw new Error(t("addTrip.selectPaceError"));

      let createdTripId = null;

      const placesArray = placesText
        .split(/[,;\n]+/)
        .map((p) => p.trim())
        .filter(Boolean);

      for (const dest of destinations) {
        if (!dest.city || !dest.startDate || !dest.endDate)
          throw new Error(t("addTrip.completeAllDestinations"));

        const destObj = dest.city || {};
        const destCityNameEn =
          (typeof destObj === "string" ? destObj : destObj.city) ||
          (typeof destObj === "object" && destObj.label
            ? destObj.label.split(",")[0].trim()
            : "") ||
          "";

        const destCountryEn =
          typeof destObj === "object" && destObj.country
            ? destObj.country
            : "";

        const destinationForApi =
          destCityNameEn + (destCountryEn ? `, ${destCountryEn}` : "");

        const payload = {
          destination: destinationForApi,
          start_date: dest.startDate,
          end_date: dest.endDate,
          notes: notes || null,
        };

        setStatusMessage(
          t("addTrip.creatingTrip", { destination: payload.destination })
        );
        const tripResponse = await apiPost("/trips", payload);
        if (!tripResponse || !tripResponse.trip || !tripResponse.trip.id)
          throw new Error(t("addTrip.createTripError"));

        createdTripId = tripResponse.trip.id;

        try {
          // Build canonical flight id from selectedFlight
          const sel = dest.selectedFlight;
          let canonicalFlightId = null;

          if (sel) {
            const datePart = dest.startDate
              ? dest.startDate.toISOString().split("T")[0]
              : "";

            const metaCode = sel?.meta?.flightCode;
            if (metaCode && String(metaCode).trim()) {
              const clean = String(metaCode)
                .replace(/\s+/g, "")
                .toUpperCase();
              canonicalFlightId = datePart ? `${clean}|${datePart}` : clean;
            } else if (sel?.id) {
              canonicalFlightId = sel.id;
            } else if (sel?.raw?.id) {
              canonicalFlightId = sel.raw.id;
            }
          }

          if (canonicalFlightId) {
            setStatusMessage(
              t("addTrip.savingFlight", { flightId: canonicalFlightId })
            );
            await apiPost("/flights", {
              flight_id: canonicalFlightId,
              trip_id: createdTripId,
            });
            setStatusMessage(
              t("addTrip.flightSaved", { flightId: canonicalFlightId })
            );
          }
        } catch (err) {
          console.error("Error guardando vuelo:", err);
        }

        setStatusMessage(t("addTrip.generatingItinerary"));

        const itineraryBody = {
          save: true,
          pace,
          places: placesArray,
          llm_notes: notes || "",
          user_id: stored.id,
          trip_id: createdTripId,
          origin_airport: dest.originAirport?.value || null,
          destination_airport: dest.destinationAirport?.value || null,
          selected_flight: dest.selectedFlight?.raw || null,
        };

        await apiPost(`/trips/${createdTripId}/itinerary`, itineraryBody);
        setStatusMessage(t("addTrip.itineraryGenerated"));
      }

      if (createdTripId) {
        setStatusMessage(null);
        nav(`/trip_itinerary/${createdTripId}`);
      }
    } catch (err) {
      console.error("Error creando viaje:", err);
      showError(t("addTrip.createTripGenericError"));
      setStatusMessage(null);
    } finally {
      setLoadingTrip(false);
      setStatusMessage(null);
    }
  };

  const monthNames = [
    t("calendar.months.january"),
    t("calendar.months.february"),
    t("calendar.months.march"),
    t("calendar.months.april"),
    t("calendar.months.may"),
    t("calendar.months.june"),
    t("calendar.months.july"),
    t("calendar.months.august"),
    t("calendar.months.september"),
    t("calendar.months.october"),
    t("calendar.months.november"),
    t("calendar.months.december"),
  ];
  const weekDays = [
    t("calendar.weekDays.sunday"),
    t("calendar.weekDays.monday"),
    t("calendar.weekDays.tuesday"),
    t("calendar.weekDays.wednesday"),
    t("calendar.weekDays.thursday"),
    t("calendar.weekDays.friday"),
    t("calendar.weekDays.saturday"),
  ];

  if (loading) {
    return (
      <div className="add-trip-root">
        <LoadingSpinner message={t("addTrip.loading")} fullScreen />
      </div>
    );
  }

  return (
    <div className="add-trip-root">
      <div className="add-trip-container">
        <div className="add-trip-left">
          <form className="form" onSubmit={handleSubmit}>
            {/* SECTION: Destination */}
            <section className="card-trip">
              <h3>{t("addTrip.destinationAndDates")}</h3>

              <label>{t("addTrip.destinationCity")}</label>
              <Select
                options={cityOptions}
                value={currentDestination.city}
                onChange={handleChangeDestinationCity}
                placeholder={t("addTrip.selectDestinationCity")}
                isClearable
                className="dropdown-select"
                classNamePrefix="react-select"
              />

              <div style={{ marginTop: 12 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {monthNames[currentMonth]} {currentYear}
                  </div>
                  <div>
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

                <div style={{ marginTop: 8 }} className="calendar">
                  <div className="week-days">
                    {weekDays.map((d, i) => (
                      <span key={i} className="week-day">
                        {d}
                      </span>
                    ))}
                  </div>
                  <div className="days-grid">
                    {Array(firstDayOfMonth)
                      .fill(null)
                      .map((_, i) => (
                        <div key={`e${i}`} className="empty-day" />
                      ))}
                    {days.map((day) => {
                      const currentDate = new Date(
                        currentYear,
                        currentMonth,
                        day.date
                      );
                      const isPast =
                        currentDate < today ||
                        alreadySelected(currentDate);
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
                          key={day.date}
                          type="button"
                          className={`day ${
                            inRange || start || end ? "selected-day" : ""
                          }`}
                          onClick={() =>
                            !isPast && handleDateSelect(day.date)
                          }
                          disabled={isPast}
                          style={{
                            borderTopLeftRadius:
                              (end || inRange) && !start ? "0" : "5.625rem",
                            borderBottomLeftRadius:
                              (end || inRange) && !start ? "0" : "5.625rem",
                            borderTopRightRadius:
                              (start || inRange) && !end ? "0" : "5.625rem",
                            borderBottomRightRadius:
                              (start || inRange) && !end ? "0" : "5.625rem",
                          }}
                        >
                          {day.date}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {currentDestination.startDate &&
                  currentDestination.endDate && (
                    <p className="date-range" style={{ marginTop: 8 }}>
                      {t("addTrip.tripFrom", {
                        city: currentDestination.city?.label || "",
                        startDate: `${currentDestination.startDate.getDate()}/${
                          currentDestination.startDate.getMonth() + 1
                        }/${currentDestination.startDate.getFullYear()}`,
                        endDate: `${currentDestination.endDate.getDate()}/${
                          currentDestination.endDate.getMonth() + 1
                        }/${currentDestination.endDate.getFullYear()}`,
                      })}
                    </p>
                  )}
              </div>
            </section>

            {/* SECTION: Flight selection (now via FlightFinder) */}
            <section className="card-trip card--white">
              <h3>{t("addTrip.flights")}</h3>

              <FlightFinder
                t={t}
                destinations={destinations}
                setDestinations={setDestinations}
                currentDestinationIndex={currentDestinationIndex}
                loading={loading}
              />
            </section>

            {/* SECTION: Preferences */}
            <section className="card-trip">
              <h3>{t("addTrip.preferences")}</h3>

              <label>{t("addTrip.tripPace")}</label>
              <Select
                className="dropdown-select"
                classNamePrefix="react-select"
                placeholder={t("addTrip.selectPace")}
                options={[
                  { value: "Relajado", label: t("addTrip.paceRelaxed") },
                  { value: "Moderado", label: t("addTrip.paceModerate") },
                  { value: "Intenso", label: t("addTrip.paceIntense") },
                ]}
                value={pace ? { value: pace, label: pace } : null}
                onChange={(option) => setPace(option.value)}
                isSearchable={false}
              />

              <label style={{ marginTop: 10 }}>
                {t("addTrip.placesToInclude")}
              </label>
              <textarea
                value={placesText}
                className="textarea"
                onChange={(e) => setPlacesText(e.target.value)}
                rows={3}
                placeholder={t("addTrip.placesPlaceholder")}
              />

              <label style={{ marginTop: 10 }}>
                {t("addTrip.tripNotes")}
              </label>
              <textarea
                value={notes}
                className="textarea"
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder={t("addTrip.notesPlaceholder")}
              />
            </section>

            {statusMessage && (
              <div style={{ marginBottom: 12, color: "#333" }}>
                {statusMessage}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, paddingBottom: 30 }}>
              <button
                type="submit"
                className="btn-primary create-trip"
                disabled={loadingTrip}
              >
                {loadingTrip
                  ? t("addTrip.creating")
                  : t("addTrip.createTrip")}
              </button>
              <button
                type="button"
                className="btn-secondary add-destination"
                onClick={handleAddDestination}
              >
                {t("addTrip.addAnotherDestination")}
              </button>
            </div>
          </form>
        </div>

        <div className="add-trip-right">
          <div>
            <div className="hero-art-t" aria-hidden>
              <LogoSvg />
            </div>
            <div className="brand-t">ComfTrip</div>
          </div>
        </div>
      </div>
      {statusMessage && <LoadTrip statusMessage={statusMessage} />}
    </div>
  );
}
