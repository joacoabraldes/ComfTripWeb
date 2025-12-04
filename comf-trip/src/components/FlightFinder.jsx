// src/components/FlightFinder.jsx
import React, { useState, useEffect, useMemo } from "react";
import Select from "react-select";
import { Country, City } from "country-state-city";
import countryList from "react-select-country-list";
import flightsApi from "../services/flightsApi";

export default function FlightFinder({
  t,
  destinations,
  setDestinations,
  currentDestinationIndex,
  loading // from AddTrip (trips loading)
}) {
  // Mode: true = use "Código de vuelo", false = airports picker
  const [useFlightCode, setUseFlightCode] = useState(true);

  // Flight code search
  const [flightCode, setFlightCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [lastFoundFlight, setLastFoundFlight] = useState(null); // summary for code search

  // Airports-related state (per destination index)
  const [originCityOptionsByIndex, setOriginCityOptionsByIndex] = useState({});
  const [airportOptionsByIndex, setAirportOptionsByIndex] = useState({});
  const [airportsLoadingMap, setAirportsLoadingMap] = useState({});

  const currentDestination = destinations[currentDestinationIndex] || {};

  /* -------------------------------------------------
     Country options for originCountry Select
     ------------------------------------------------- */
  const countryOptions = useMemo(() => {
    const data = countryList().getData(); // [{label,value}]
    try {
      const dn = new Intl.DisplayNames(["es"], { type: "region" });
      return data.map((d) => ({
        ...d,
        label: dn.of(d.value) || d.label
      }));
    } catch (e) {
      return data;
    }
  }, []);

  /* -------------------------------------------------
     Origin city options (local search with country-state-city)
     ------------------------------------------------- */
  const originCityOptions =
    originCityOptionsByIndex[currentDestinationIndex] || [];
  const originAirportOptions =
    (airportOptionsByIndex[currentDestinationIndex] || {}).origin || [];
  const destAirportOptions =
    (airportOptionsByIndex[currentDestinationIndex] || {}).destination || [];

  const fetchOriginCityOptions = (input, idx) => {
    const safeInput =
      typeof input === "string" ? input.trim() : String(input || "");
    if (!safeInput || safeInput.length < 2) {
      setOriginCityOptionsByIndex((prev) => ({ ...prev, [idx]: [] }));
      return;
    }

    const originCountryVal = destinations[idx]?.originCountry || null;
    const isoCode = originCountryVal?.value || null; // countryList ISO2
    if (!isoCode) {
      setOriginCityOptionsByIndex((prev) => ({ ...prev, [idx]: [] }));
      return;
    }

    const allCountries = Country.getAllCountries();
    const found =
      allCountries.find((c) => c.isoCode === isoCode) || null;

    let countryLabelEs = found?.name || "";
    try {
      if (typeof Intl !== "undefined" && Intl.DisplayNames) {
        const dn = new Intl.DisplayNames(["es"], { type: "region" });
        const maybe = dn.of(isoCode);
        if (maybe && typeof maybe === "string") countryLabelEs = maybe;
      }
    } catch (e) {
      // ignore
    }

    let cities = [];
    try {
      cities = City.getCitiesOfCountry(isoCode) || [];
    } catch (e) {
      cities = [];
    }

    const q = safeInput.toLowerCase();
    const seen = new Set();
    const out = [];

    for (let i = 0; i < cities.length && out.length < 100; i++) {
      const c = cities[i];
      if (!c || !c.name) continue;
      if (c.name.toLowerCase().includes(q)) {
        const key = `${c.name}|||${isoCode || ""}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({
            value: key,
            label: `${c.name}${
              countryLabelEs ? ", " + countryLabelEs : ""
            }`,
            meta: { cityName: c.name, countryName: countryLabelEs || "" }
          });
        }
      }
    }

    setOriginCityOptionsByIndex((prev) => ({ ...prev, [idx]: out }));
  };

  /* -------------------------------------------------
     Airports search (OurAirports via flightsApi)
     ------------------------------------------------- */

  const awaitFetchAirports = (cityOrKeyword, idx, type, countryCode) => {
    fetchAirports(cityOrKeyword, idx, type, countryCode).catch((err) => {
      console.error("fetchAirports wrapper error", err);
    });
  };

  const fetchAirports = async (
    keywordOrCityName,
    idx,
    type = "destination",
    countryCode
  ) => {
    if (!keywordOrCityName && !countryCode) return;
    setAirportsLoadingMap((prev) => ({ ...prev, [idx]: true }));
    try {
      const items = await flightsApi.getAirportOptionsForSelect(
        "",
        200,
        countryCode,
        keywordOrCityName || ""
      );
      setAirportOptionsByIndex((prev) => ({
        ...prev,
        [idx]: { ...(prev[idx] || {}), [type]: items || [] }
      }));
    } catch (err) {
      console.error("Error fetching airports for", keywordOrCityName, err);
      setAirportOptionsByIndex((prev) => ({
        ...prev,
        [idx]: { ...(prev[idx] || {}), [type]: [] }
      }));
    } finally {
      setAirportsLoadingMap((prev) => ({ ...prev, [idx]: false }));
    }
  };

  /* -------------------------------------------------
     Handlers: origin country / city / airports / select flight
     ------------------------------------------------- */

  const handleChangeOriginCountry = (option) => {
    setDestinations((prev) => {
      const copy = [...prev];
      copy[currentDestinationIndex] = {
        ...(copy[currentDestinationIndex] || {}),
        originCountry: option,
        originCity: null,
        originAirport: null,
        flightOffers: [],
        selectedFlight: null
      };
      return copy;
    });
    setAirportOptionsByIndex((prev) => ({
      ...prev,
      [currentDestinationIndex]: {
        ...(prev[currentDestinationIndex] || {}),
        origin: []
      }
    }));
    setOriginCityOptionsByIndex((prev) => ({
      ...prev,
      [currentDestinationIndex]: []
    }));
  };

  const handleChangeOriginCity = (val) => {
    setDestinations((prev) => {
      const copy = [...prev];
      copy[currentDestinationIndex] = {
        ...(copy[currentDestinationIndex] || {}),
        originCity: val,
        originAirport: null,
        flightOffers: [],
        selectedFlight: null
      };
      return copy;
    });

    const cityName =
      val?.meta?.cityName ||
      val?.meta?.countryName ||
      val?.label ||
      val?.value ||
      "";
    const originCountryVal =
      destinations[currentDestinationIndex]?.originCountry || null;
    const countryCode = originCountryVal?.value || undefined;

    awaitFetchAirports(
      cityName,
      currentDestinationIndex,
      "origin",
      countryCode
    );
  };

  const handleChangeAirport = (which, opt) => {
    setDestinations((prev) => {
      const copy = [...prev];
      const current = { ...(copy[currentDestinationIndex] || {}) };
      if (which === "origin") current.originAirport = opt;
      else current.destinationAirport = opt;
      current.flightOffers = [];
      current.selectedFlight = null;
      copy[currentDestinationIndex] = current;
      return copy;
    });
  };

  const handleSelectFlight = (opt) => {
    setDestinations((prev) => {
      const copy = [...prev];
      const current = { ...(copy[currentDestinationIndex] || {}) };
      current.selectedFlight = opt;
      copy[currentDestinationIndex] = current;
      return copy;
    });
  };

  /* -------------------------------------------------
     Helpers for times + renderFlightOption
     ------------------------------------------------- */

  const extractHHMM = (value) => {
    if (!value) return "";
    const m = String(value).match(/(\d{2}:\d{2})/);
    return m ? m[1] : "";
  };

  const getDepartureTimeFromAero = (flight) => {
    // For airport-departures endpoint: movement.scheduledTime.{local,utc}
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

    // For flights/number endpoint: departure.scheduledTimeLocal / scheduledTimeUtc / local / utc
    const dep = flight?.departure || {};
    const schedDep =
      dep.scheduledTime ||
      dep ||
      {}; // dep may already have .local / .utc

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
          alignItems: "center"
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

  /* -------------------------------------------------
     Auto-fetch destination airports when destination city changes
     ------------------------------------------------- */

  useEffect(() => {
    const idx = currentDestinationIndex;
    const dest = destinations[idx];
    if (!dest || !dest.city) return;

    const cityObj = dest.city;
    const cityName =
      cityObj.meta?.cityName ||
      cityObj.city ||
      (cityObj.label
        ? cityObj.label.split(",")[0].trim()
        : "") ||
      cityObj.value ||
      "";
    const countryCode = cityObj.countryCode || undefined;

    if (!cityName) return;

    awaitFetchAirports(cityName, idx, "destination", countryCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDestinationIndex, destinations[currentDestinationIndex]?.city]);

  /* -------------------------------------------------
     Flight offers by route when in airports mode (AeroDataBox)
     ------------------------------------------------- */

  useEffect(() => {
    const idx = currentDestinationIndex;
    const dest = destinations[idx];
    if (!dest) return;

    // Only in "no code" mode
    if (useFlightCode) return;

    const originCode = dest.originAirport?.value;
    const destCode = dest.destinationAirport?.value;

    // Normalize date to YYYY-MM-DD string
    let depDateStr = null;
    if (dest.startDate instanceof Date) {
      depDateStr = dest.startDate.toISOString().slice(0, 10);
    } else if (typeof dest.startDate === "string") {
      depDateStr = dest.startDate.slice(0, 10);
    }

    // Only search when everything is filled
    if (!originCode || !destCode || !depDateStr) {
      return;
    }

    let cancelled = false;

    // mark loading
    setDestinations((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...(copy[idx] || {}),
        offersLoading: true,
        flightOffers: [],
        selectedFlight: null
      };
      return copy;
    });

    (async () => {
      try {
        const res = await flightsApi.searchFlights({
          originLocationCode: originCode,
          destinationLocationCode: destCode,
          departureDate: depDateStr
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
              duration: null
            }
          };
        });

        setDestinations((prev) => {
          const copy = [...prev];
          copy[idx] = {
            ...(copy[idx] || {}),
            flightOffers: offers,
            offersLoading: false
          };
          return copy;
        });
      } catch (err) {
        console.error("Error fetching flights from AeroDataBox", err);
        if (cancelled) return;
        setDestinations((prev) => {
          const copy = [...prev];
          copy[idx] = {
            ...(copy[idx] || {}),
            flightOffers: [],
            offersLoading: false
          };
          return copy;
        });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    useFlightCode,
    currentDestinationIndex,
    destinations[currentDestinationIndex]?.originAirport?.value,
    destinations[currentDestinationIndex]?.destinationAirport?.value,
    destinations[currentDestinationIndex]?.startDate
      ? destinations[currentDestinationIndex].startDate.toString()
      : null
  ]);

  /* -------------------------------------------------
     Flight search by code (AeroDataBox flights/number)
     ------------------------------------------------- */

  const handleSearchByCode = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    const code = flightCode.trim();
    if (!code) {
      setErrorMsg("Ingresá un código de vuelo.");
      setLastFoundFlight(null);
      return;
    }

    setErrorMsg(null);
    setLastFoundFlight(null);
    setCodeLoading(true);

    try {
      const date = currentDestination.startDate || null;

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
          duration: null
        }
      };

      const depAirport = f.departure?.airport || f.movement?.airport || {};
      const arrAirport = f.arrival?.airport || {};
      const originIata =
        depAirport.iata || depAirport.iataCode || depAirport.iata_code || "";
      const destIata =
        arrAirport.iata || arrAirport.iataCode || arrAirport.iata_code || "";

      const originAirport =
        originIata && depAirport.name
          ? {
              value: originIata,
              label: `${originIata} — ${depAirport.name}`,
              meta: {
                iata: originIata,
                cityName: depAirport.municipality || "",
                countryName: depAirport.countryName || ""
              }
            }
          : currentDestination.originAirport || null;

      const destinationAirport =
        destIata && arrAirport.name
          ? {
              value: destIata,
              label: `${destIata} — ${arrAirport.name}`,
              meta: {
                iata: destIata,
                cityName: arrAirport.municipality || "",
                countryName: arrAirport.countryName || ""
              }
            }
          : currentDestination.destinationAirport || null;

      setDestinations((prev) => {
        const copy = [...prev];
        const cur = { ...(copy[currentDestinationIndex] || {}) };
        cur.selectedFlight = option;
        cur.flightOffers = [option];
        cur.originAirport = originAirport;
        cur.destinationAirport = destinationAirport;
        copy[currentDestinationIndex] = cur;
        return copy;
      });

      // summary for the user under the input
      setLastFoundFlight({
        code: flightCodeStr,
        airline: airlineName,
        time: times
      });
    } catch (err) {
      console.error("Error buscando vuelo por código:", err);
      setErrorMsg("Ocurrió un error buscando el vuelo.");
    } finally {
      setCodeLoading(false);
    }
  };

  /* -------------------------------------------------
     JSX
     ------------------------------------------------- */

  return (
    <div className="flight-code-finder">
      {/* Código de vuelo (solo cuando se usa el código) */}
      {useFlightCode && (
        <>
          <label className="flight-code-label">Código de vuelo</label>

          {/* No inner <form> to avoid submitting the main AddTrip form */}
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
                fontSize: 14
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
                lineHeight: 1.2
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
                marginBottom: 4
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
                fontSize: 13
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
          marginBottom: 12
        }}
      >
        {useFlightCode ? "No conozco el código" : "Quiero usar el código"}
      </button>

      {/* Airports-based UI */}
      {!useFlightCode && (
        <div className="flights-grid">
          <div className="field">
            <label>{t("addTrip.originCountry")}</label>
            <Select
              className="dropdown-select"
              classNamePrefix="react-select"
              options={countryOptions}
              value={currentDestination.originCountry || null}
              onChange={handleChangeOriginCountry}
              placeholder={t("addTrip.selectOriginCountry")}
              isDisabled={loading}
            />
          </div>

          <div className="field">
            <label>{t("addTrip.originCity")}</label>
            <Select
              className="dropdown-select"
              classNamePrefix="react-select"
              options={originCityOptions}
              value={currentDestination.originCity}
              onChange={handleChangeOriginCity}
              onInputChange={(inputValue) => {
                fetchOriginCityOptions(
                  String(inputValue || ""),
                  currentDestinationIndex
                );
                return inputValue;
              }}
              placeholder={
                currentDestination.originCountry
                  ? t("addTrip.typeMin2Letters")
                  : t("addTrip.selectCountryFirst")
              }
              isClearable
              noOptionsMessage={() => t("addTrip.typeToSearchCities")}
              isDisabled={!currentDestination.originCountry}
            />
          </div>

          <div className="field">
            <label>{t("addTrip.originAirport")}</label>
            <Select
              className="dropdown-select"
              classNamePrefix="react-select"
              options={originAirportOptions}
              value={currentDestination.originAirport}
              onChange={(opt) => handleChangeAirport("origin", opt)}
              placeholder={
                airportsLoadingMap[currentDestinationIndex]
                  ? t("addTrip.loadingAirports")
                  : t("addTrip.selectOriginAirport")
              }
              isClearable
              isDisabled={
                airportsLoadingMap[currentDestinationIndex] ||
                !currentDestination.originCity
              }
            />
          </div>

          <div className="field">
            <label>{t("addTrip.destinationAirport")}</label>
            <Select
              className="dropdown-select"
              classNamePrefix="react-select"
              options={destAirportOptions}
              value={currentDestination.destinationAirport}
              onChange={(opt) => handleChangeAirport("destination", opt)}
              placeholder={
                airportsLoadingMap[currentDestinationIndex]
                  ? t("addTrip.loadingAirports")
                  : t("addTrip.selectDestinationAirport")
              }
              isClearable
              isDisabled={
                airportsLoadingMap[currentDestinationIndex] ||
                !currentDestination.city
              }
            />
          </div>

          <div className="field wide">
            <label>{t("addTrip.availableFlights")}</label>
            <Select
              className="dropdown-select"
              classNamePrefix="react-select"
              options={currentDestination.flightOffers || []}
              value={currentDestination.selectedFlight}
              onChange={handleSelectFlight}
              placeholder={
                currentDestination.offersLoading
                  ? t("addTrip.searchingFlights")
                  : t("addTrip.selectFlight")
              }
              isClearable
              isDisabled={
                currentDestination.offersLoading ||
                !(currentDestination.flightOffers?.length > 0)
              }
              formatOptionLabel={(option) => renderFlightOption(option)}
              isOptionSelected={(option, value) => option.id === value?.id}
            />
          </div>
        </div>
      )}
    </div>
  );
}
