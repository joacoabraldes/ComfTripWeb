// src/components/FlightFinderItinerary.jsx
import React, { useState, useMemo, useEffect } from "react";
import Select from "react-select";
import countryList from "react-select-country-list";
import { Country, City } from "country-state-city";
import flightsApi from "../services/flightsApi";
import { apiPost } from "../pages/api";

/* ------------------------ helpers ------------------------ */

const parseCityCountryFromString = (str) => {
  if (!str || typeof str !== "string") return { cityName: "", countryName: "" };
  const parts = str
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return {
      cityName: parts.slice(0, parts.length - 1).join(", "),
      countryName: parts[parts.length - 1],
    };
  }
  return { cityName: parts[0] || "", countryName: "" };
};

const getIsoFromCountryName = (countryName) => {
  if (!countryName) return undefined;
  try {
    const all = Country.getAllCountries() || [];
    const found = all.find(
      (c) =>
        c.name &&
        c.name.toLowerCase() === String(countryName).toLowerCase()
    );
    return found?.isoCode || undefined;
  } catch (e) {
    return undefined;
  }
};

const extractHHMM = (value) => {
  if (!value) return "";
  const m = String(value).match(/(\d{2}:\d{2})/);
  return m ? m[1] : "";
};

const getDepartureTimeFromAero = (flight) => {
  const movement = flight?.movement || {};
  const schedMove =
    movement.scheduledTime ||
    movement.scheduled ||
    movement.actualTime ||
    {};
  const fromMovement =
    schedMove.local ||
    schedMove.utc ||
    schedMove.scheduledTimeLocal ||
    schedMove.scheduledTimeUtc ||
    "";

  const dep = flight?.departure || {};
  const schedDep = dep.scheduledTime || dep || {};
  const fromDeparture =
    schedDep.local ||
    schedDep.utc ||
    schedDep.scheduledTimeLocal ||
    schedDep.scheduledTimeUtc ||
    "";

  return extractHHMM(fromMovement || fromDeparture);
};

const renderFlightOption = (option) => {
  const m = option.meta || {};
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
      }}
    >
      <div style={{ fontWeight: 700 }}>
        {m.flightCode || option.label}
      </div>
      <div style={{ textAlign: "right", fontSize: 13, color: "#333" }}>
        {m.times && <div style={{ marginBottom: 2 }}>{m.times}</div>}
        {m.airline && <div style={{ color: "#555" }}>{m.airline}</div>}
      </div>
    </div>
  );
};

/* -------------------- main component --------------------- */

export default function FlightFinderItinerary({
  t,
  tripId,
  trip,
  tripStartIso,
  destination,      // e.g. "Rome, Italy"
  onFlightSaved,    // callback to refreshBackendFlight
}) {
  // toggle: code vs airports
  const [useFlightCode, setUseFlightCode] = useState(true);

  // code search state
  const [flightCode, setFlightCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [lastFoundFlight, setLastFoundFlight] = useState(null);

  // airports state (single “destination” instead of destinations[])
  const [originCountry, setOriginCountry] = useState(null);
  const [originCityOptions, setOriginCityOptions] = useState([]);
  const [originCity, setOriginCity] = useState(null);

  const [originAirportOptions, setOriginAirportOptions] = useState([]);
  const [destAirportOptions, setDestAirportOptions] = useState([]);
  const [airportsLoading, setAirportsLoading] = useState(false);

  const [originAirport, setOriginAirport] = useState(null);
  const [destinationAirport, setDestinationAirport] = useState(null);

  const [flightOffers, setFlightOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState(null);

  const [statusMessage, setStatusMessage] = useState(null);

  /* ---------------- country options ---------------- */

  const countryOptions = useMemo(() => {
    const data = countryList().getData();
    try {
      const dn = new Intl.DisplayNames(["es"], { type: "region" });
      return data.map((d) => ({
        ...d,
        label: dn.of(d.value) || d.label,
      }));
    } catch (e) {
      return data;
    }
  }, []);

  /* ---------------- origin city search ---------------- */

  const fetchOriginCityOptions = (input) => {
    const safe = typeof input === "string" ? input.trim() : String(input || "");
    if (!safe || safe.length < 2 || !originCountry) {
      setOriginCityOptions([]);
      return;
    }

    const isoCode = originCountry.value;
    if (!isoCode) {
      setOriginCityOptions([]);
      return;
    }

    let cities = [];
    try {
      cities = City.getCitiesOfCountry(isoCode) || [];
    } catch (e) {
      cities = [];
    }

    let countryLabel = "";
    try {
      const found =
        Country.getAllCountries().find((c) => c.isoCode === isoCode) || null;
      countryLabel = found?.name || "";
      if (Intl.DisplayNames) {
        const dn = new Intl.DisplayNames(["es"], { type: "region" });
        const maybe = dn.of(isoCode);
        if (maybe) countryLabel = maybe;
      }
    } catch (e) {
      // ignore
    }

    const q = safe.toLowerCase();
    const seen = new Set();
    const out = [];

    for (let i = 0; i < cities.length && out.length < 100; i++) {
      const c = cities[i];
      if (!c || !c.name) continue;
      if (c.name.toLowerCase().includes(q)) {
        const key = `${c.name}|||${isoCode}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({
            value: key,
            label: `${c.name}${countryLabel ? ", " + countryLabel : ""}`,
            meta: { cityName: c.name, countryName: countryLabel || "" },
          });
        }
      }
    }

    setOriginCityOptions(out);
  };

  /* ---------------- airports search ---------------- */

  const awaitFetchAirports = (cityOrKeyword, type, countryCode) => {
    fetchAirports(cityOrKeyword, type, countryCode).catch((err) =>
      console.error("fetchAirports wrapper error (itinerary)", err)
    );
  };

  const fetchAirports = async (
    keywordOrCityName,
    type = "destination",
    countryCode
  ) => {
    if (!keywordOrCityName && !countryCode) return;
    setAirportsLoading(true);
    try {
      const items = await flightsApi.getAirportOptionsForSelect(
        "",
        200,
        countryCode,
        keywordOrCityName || ""
      );

      if (type === "origin") {
        setOriginAirportOptions(items || []);
      } else {
        setDestAirportOptions(items || []);
      }
    } catch (err) {
      console.error("Error fetching airports (itinerary):", err);
      if (type === "origin") {
        setOriginAirportOptions([]);
      } else {
        setDestAirportOptions([]);
      }
    } finally {
      setAirportsLoading(false);
    }
  };

  const handleChangeOriginCountry = (option) => {
    setOriginCountry(option);
    setOriginCity(null);
    setOriginCityOptions([]);
    setOriginAirport(null);
    setOriginAirportOptions([]);
    setFlightOffers([]);
    setSelectedFlight(null);
  };

  const handleChangeOriginCity = (val) => {
    setOriginCity(val);
    setOriginAirport(null);
    setOriginAirportOptions([]);
    setFlightOffers([]);
    setSelectedFlight(null);

    const cityName =
      val?.meta?.cityName || val?.meta?.countryName || val?.label || val?.value || "";
    const countryCode = originCountry?.value || undefined;

    awaitFetchAirports(cityName, "origin", countryCode);
  };

  const handleChangeAirport = (which, opt) => {
    if (which === "origin") {
      setOriginAirport(opt);
    } else {
      setDestinationAirport(opt);
    }
    setFlightOffers([]);
    setSelectedFlight(null);
  };

  /* ---------- pre-fill destination airport options from trip.destination ---------- */

  useEffect(() => {
    if (!destination) return;
    const parsed = parseCityCountryFromString(destination);
    const cityName = parsed.cityName || destination;
    const iso = getIsoFromCountryName(parsed.countryName);
    awaitFetchAirports(cityName, "destination", iso);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination]);

  /* ---------------- flights by route (AeroDataBox) ---------------- */

  useEffect(() => {
    if (useFlightCode) return; // only in airports mode
    const originCode = originAirport?.value;
    const destCode = destinationAirport?.value;
    const depDateStr = tripStartIso || null;

    if (!originCode || !destCode || !depDateStr) return;

    let cancelled = false;

    setOffersLoading(true);
    setFlightOffers([]);
    setSelectedFlight(null);

    (async () => {
      try {
        const res = await flightsApi.searchFlights({
          originLocationCode: originCode,
          destinationLocationCode: destCode,
          departureDate: depDateStr,
        });

        if (cancelled) return;

        const flights = res?.data || [];
        const offers = flights.map((f, i) => {
          const airlineName = f.airline?.name || "";
          const flightCodeStr = (f.number || "").trim();

          const depTimeHHMM = getDepartureTimeFromAero(f);
          const times = depTimeHHMM ? `${depTimeHHMM}` : "";

          const labelParts = [];
          if (flightCodeStr) labelParts.push(flightCodeStr);
          if (airlineName) labelParts.push(airlineName);
          if (times) labelParts.push(times);

          const label = labelParts.join(" · ") || "Vuelo";

          return {
            id: flightCodeStr || `flight_${i}`,
            label,
            raw: f,
            meta: {
              flightCode: flightCodeStr,
              airline: airlineName,
              times,
              stops: 0,
              duration: null,
            },
          };
        });

        setFlightOffers(offers);
      } catch (err) {
        console.error("Error fetching flights (itinerary route):", err);
        if (!cancelled) {
          setFlightOffers([]);
        }
      } finally {
        if (!cancelled) {
          setOffersLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [useFlightCode, originAirport?.value, destinationAirport?.value, tripStartIso]);

  /* ---------------- flight search by code ---------------- */

  const handleSearchByCode = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const code = flightCode.trim();
    if (!code) {
      setErrorMsg("Ingresá un código de vuelo.");
      setLastFoundFlight(null);
      return;
    }

    setErrorMsg(null);
    setLastFoundFlight(null);
    setCodeLoading(true);
    setStatusMessage(null);

    try {
      const date =
        tripStartIso && tripStartIso.length >= 10
          ? new Date(tripStartIso)
          : null;

      const flights = await flightsApi.searchFlightByCode(code, date);

      if (!flights || flights.length === 0) {
        setErrorMsg("No encontré ningún vuelo con ese código.");
        return;
      }

      const f = flights[0];
      const airlineName = f.airline?.name || "";
      const flightCodeStr = (f.number || code.toUpperCase()).trim();

      const depTimeHHMM = getDepartureTimeFromAero(f);
      const times = depTimeHHMM ? `${depTimeHHMM}` : "";

      const option = {
        id: flightCodeStr,
        label: `${flightCodeStr}${
          airlineName ? " · " + airlineName : ""
        }${times ? " · " + times : ""}`,
        raw: f,
        meta: {
          flightCode: flightCodeStr,
          airline: airlineName,
          times,
          stops: 0,
          duration: null,
        },
      };

      const depAirport = f.departure?.airport || f.movement?.airport || {};
      const arrAirport = f.arrival?.airport || {};
      const originIata =
        depAirport.iata || depAirport.iataCode || depAirport.iata_code || "";
      const destIata =
        arrAirport.iata || arrAirport.iataCode || arrAirport.iata_code || "";

      const originAirportOpt =
        originIata && depAirport.name
          ? {
              value: originIata,
              label: `${originIata} — ${depAirport.name}`,
              meta: {
                iata: originIata,
                cityName: depAirport.municipality || "",
                countryName: depAirport.countryName || "",
              },
            }
          : originAirport || null;

      const destinationAirportOpt =
        destIata && arrAirport.name
          ? {
              value: destIata,
              label: `${destIata} — ${arrAirport.name}`,
              meta: {
                iata: destIata,
                cityName: arrAirport.municipality || "",
                countryName: arrAirport.countryName || "",
              },
            }
          : destinationAirport || null;

      setOriginAirport(originAirportOpt);
      setDestinationAirport(destinationAirportOpt);
      setFlightOffers([option]);
      setSelectedFlight(option);

      setLastFoundFlight({
        code: flightCodeStr,
        airline: airlineName,
        time: times,
      });
    } catch (err) {
      console.error("Error buscando vuelo por código (itinerary):", err);
      setErrorMsg("Ocurrió un error buscando el vuelo.");
    } finally {
      setCodeLoading(false);
    }
  };

  /* ---------------- save flight to backend ---------------- */

  const computeCanonicalFlightId = () => {
    const sel = selectedFlight;
    if (!sel) return null;

    const datePart = tripStartIso || null;
    const metaCode = sel?.meta?.flightCode;

    let base = null;
    if (metaCode && String(metaCode).trim()) {
      base = String(metaCode).replace(/\s+/g, "").toUpperCase();
    } else if (sel.id) {
      base = sel.id;
    } else if (sel.raw?.id) {
      base = sel.raw.id;
    } else if (sel.value) {
      base = sel.value;
    }

    if (!base) return null;
    return datePart ? `${base}|${datePart}` : base;
  };

  const handleSaveFlight = async () => {
    if (!selectedFlight) {
      setStatusMessage("Seleccioná un vuelo primero.");
      return;
    }
    try {
      const canonicalFlightId = computeCanonicalFlightId();
      if (!canonicalFlightId) {
        setStatusMessage("No pude determinar el ID del vuelo.");
        return;
      }
      setStatusMessage("Guardando vuelo…");
      await apiPost("/flights", {
        flight_id: canonicalFlightId,
        trip_id: tripId,
      });
      setStatusMessage("Vuelo guardado.");
      if (onFlightSaved) {
        await onFlightSaved();
      }
    } catch (err) {
      console.error("Error guardando vuelo (itinerary):", err);
      setStatusMessage("Ocurrió un error guardando el vuelo.");
    } finally {
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  /* ---------------- JSX ---------------- */

  return (
    <div className="flight-code-finder">
      {/* Código de vuelo */}
      {useFlightCode && (
        <>
          <label className="flight-code-label">Código de vuelo</label>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              type="text"
              value={flightCode}
              onChange={(e) => setFlightCode(e.target.value)}
              placeholder="Ej: AA123"
              className="flight-code-input"
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid #ccc",
                fontSize: 14,
              }}
            />
            <button
              type="button"
              onClick={handleSearchByCode}
              className="btn-primary"
              disabled={codeLoading}
              style={{
                whiteSpace: "nowrap",
                width: "auto",
                flex: "0 0 auto",
                padding: "8px 16px",
                fontSize: 14,
                lineHeight: 1.2,
              }}
            >
              {codeLoading ? "Buscando…" : "Buscar vuelo"}
            </button>
          </div>

          {errorMsg && (
            <div
              style={{
                color: "#c0392b",
                fontSize: 13,
                marginBottom: 4,
              }}
            >
              {errorMsg}
            </div>
          )}

          {lastFoundFlight && (
            <div
              style={{
                marginBottom: 12,
                padding: "8px 10px",
                borderRadius: 6,
                background: "#f8fafc",
                border: "1px solid #e1e7ef",
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 2 }}>
                {lastFoundFlight.code}
              </div>
              {lastFoundFlight.airline && (
                <div>{lastFoundFlight.airline}</div>
              )}
              {lastFoundFlight.time && (
                <div style={{ color: "#555" }}>
                  Horario: {lastFoundFlight.time}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* toggle code / airports */}
      <button
        type="button"
        className="link-button"
        onClick={() => setUseFlightCode((prev) => !prev)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          margin: 0,
          color: "#0077cc",
          fontSize: 13,
          cursor: "pointer",
          textDecoration: "underline",
          marginBottom: 12,
        }}
      >
        {useFlightCode ? "No conozco el código" : "Quiero usar el código"}
      </button>

      {/* Airports mode */}
      {!useFlightCode && (
        <div className="flights-grid">
          <div className="field">
            <label>{t("addTrip.originCountry")}</label>
            <Select
              className="dropdown-select"
              classNamePrefix="react-select"
              options={countryOptions}
              value={originCountry}
              onChange={handleChangeOriginCountry}
              placeholder={t("addTrip.selectOriginCountry")}
            />
          </div>

          <div className="field">
            <label>{t("addTrip.originCity")}</label>
            <Select
              className="dropdown-select"
              classNamePrefix="react-select"
              options={originCityOptions}
              value={originCity}
              onChange={handleChangeOriginCity}
              onInputChange={(inputValue) => {
                fetchOriginCityOptions(String(inputValue || ""));
                return inputValue;
              }}
              placeholder={
                originCountry
                  ? t("addTrip.typeMin2Letters")
                  : t("addTrip.selectCountryFirst")
              }
              isClearable
              noOptionsMessage={() => t("addTrip.typeToSearchCities")}
              isDisabled={!originCountry}
            />
          </div>

          <div className="field">
            <label>{t("addTrip.originAirport")}</label>
            <Select
              className="dropdown-select"
              classNamePrefix="react-select"
              options={originAirportOptions}
              value={originAirport}
              onChange={(opt) => handleChangeAirport("origin", opt)}
              placeholder={
                airportsLoading
                  ? t("addTrip.loadingAirports")
                  : t("addTrip.selectOriginAirport")
              }
              isClearable
              isDisabled={airportsLoading || !originCity}
            />
          </div>

          <div className="field">
            <label>{t("addTrip.destinationAirport")}</label>
            <Select
              className="dropdown-select"
              classNamePrefix="react-select"
              options={destAirportOptions}
              value={destinationAirport}
              onChange={(opt) => handleChangeAirport("destination", opt)}
              placeholder={
                airportsLoading
                  ? t("addTrip.loadingAirports")
                  : t("addTrip.selectDestinationAirport")
              }
              isClearable
              isDisabled={airportsLoading}
            />
          </div>

          <div className="field wide">
            <label>{t("addTrip.availableFlights")}</label>
            <Select
              className="dropdown-select"
              classNamePrefix="react-select"
              options={flightOffers}
              value={selectedFlight}
              onChange={setSelectedFlight}
              placeholder={
                offersLoading
                  ? t("addTrip.searchingFlights")
                  : t("addTrip.selectFlight")
              }
              isClearable
              isDisabled={offersLoading || !(flightOffers?.length > 0)}
              formatOptionLabel={renderFlightOption}
              isOptionSelected={(option, value) => option.id === value?.id}
            />
          </div>
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          className="btn-primary"
          onClick={handleSaveFlight}
          disabled={!selectedFlight}
        >
          Guardar vuelo
        </button>
        {statusMessage && (
          <span style={{ marginLeft: 10, fontSize: 13, color: "#333" }}>
            {statusMessage}
          </span>
        )}
      </div>
    </div>
  );
}
