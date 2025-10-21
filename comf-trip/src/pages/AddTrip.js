import React, { useState, useMemo, useEffect } from "react";
import { apiPost, apiGet } from "./api";
import { useNavigate } from "react-router-dom";
import "../styles/AddTrip.css";
import LogoSvg from "../components/LogoSvg";
import Select from "react-select";
import Header from "../components/Header";
import flightsApi from "../services/flightsApi";
import { Country, City } from "country-state-city";
import countryList from "react-select-country-list";

export default function AddTrip() {
  // small ISO map for a few countries used in UI
  const COUNTRY_NAME_TO_CODE = {
    Spain: "ES",
    Argentina: "AR",
    Italy: "IT",
    Germany: "DE",
    France: "FR",
  };

  // ---------- Helper to normalize country value (string or react-select option) ----------
  const getCountryName = (countryVal) => {
    if (!countryVal) return "";
    if (typeof countryVal === "string") return countryVal;
    // react-select option from countryList() usually has { label, value }
    if (typeof countryVal === "object") {
      return (
        countryVal.label ||
        countryVal.value ||
        countryVal.name ||
        ""
      ).toString();
    }
    return "";
  };

  const [destinations, setDestinations] = useState([
    {
      city: null,
      startDate: null,
      endDate: null,
      originCountry: null, // stores the react-select option object (or null)
      originCity: null,
      originAirport: null,
      destinationAirport: null,
      flightOffers: [],
      offersLoading: false,
      selectedFlight: null,
    },
  ]);
  const countryOptions = useMemo(() => {
    const data = countryList().getData();
    try {
      const dn = new Intl.DisplayNames(["es"], { type: "region" });
      return data.map((d) => ({ ...d, label: dn.of(d.value) || d.label }));
    } catch (e) {
      return data;
    }
  }, []);

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

  // dynamic options
  const [airportOptionsByIndex, setAirportOptionsByIndex] = useState({});
  const [originCityOptionsByIndex, setOriginCityOptionsByIndex] = useState({});
  const [airportsLoadingMap, setAirportsLoadingMap] = useState({});

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

  const normalizeDate = (d) => {
    if (!d) return new Date();
    const date = d.split("T")[0].split("-");
    const yy = Number(date[0]);
    const mm = Number(date[1]) - 1;
    const dd = Number(date[2]);
    return new Date(yy, mm, dd);
  };

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

  const handlePrevMonth = () =>
    setCurrentMonth((prev) =>
      prev === 0 ? (setCurrentYear((c) => c - 1), 11) : prev - 1
    );
  const handleNextMonth = () =>
    setCurrentMonth((prev) =>
      prev === 11 ? (setCurrentYear((c) => c + 1), 0) : prev + 1
    );

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

  // parse helper (used for airport option parsing)
  const parseCityCountryFromOption = (opt) => {
    const cityName = (opt?.meta?.cityName || opt?.cityName || "")?.trim();
    const countryName = (
      opt?.meta?.countryName ||
      opt?.countryName ||
      ""
    )?.trim();
    if (cityName || countryName) return { cityName, countryName };

    const label = opt?.label || "";
    const m = label.match(/\(([^)]+)\)/);
    if (m && m[1]) {
      const parts = m[1].split(",").map((p) => p.trim());
      if (parts.length >= 2) {
        return { cityName: parts[0], countryName: parts[parts.length - 1] };
      } else if (parts.length === 1) {
        return { cityName: parts[0], countryName: "" };
      }
    }
    return { cityName: "", countryName: "" };
  };

  // ----------------------
  // CITY AUTOCOMPLETE (local country-state-city)
  // ----------------------
  const fetchOriginCityOptions = (input, idx) => {
    const safeInput =
      typeof input === "string" ? input.trim() : String(input || "");
    if (!safeInput || safeInput.length < 2) {
      setOriginCityOptionsByIndex((prev) => ({ ...prev, [idx]: [] }));
      return;
    }

    // obtener ISO2 directamente desde la opción seleccionada (value)
    const originCountryVal = destinations[idx]?.originCountry || null;
    const originCountryCode =
      originCountryVal?.value ||
      COUNTRY_NAME_TO_CODE[getCountryName(originCountryVal)] ||
      null;
    if (!originCountryCode) {
      setOriginCityOptionsByIndex((prev) => ({ ...prev, [idx]: [] }));
      return;
    }
    const isoCode = originCountryCode; // City.getCitiesOfCountry espera ISO2

    // buscamos el objeto país para usar su nombre en label/meta (y obtenemos versión en español)
    const allCountries = Country.getAllCountries();
    const found = allCountries.find((c) => c.isoCode === isoCode) || null;

    // obtener nombre de país en español si Intl.DisplayNames está disponible
    let countryLabelEs = found?.name || "";
    try {
      if (typeof Intl !== "undefined" && Intl.DisplayNames) {
        const dn = new Intl.DisplayNames(["es"], { type: "region" });
        const maybe = dn.of(isoCode);
        if (maybe && typeof maybe === "string") countryLabelEs = maybe;
      }
    } catch (e) {
      // no pasa nada, usamos found?.name como fallback
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
        // usar isoCode en key para evitar depender del nombre en inglés
        const key = `${c.name}|||${isoCode || ""}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({
            value: key,
            label: `${c.name}${countryLabelEs ? ", " + countryLabelEs : ""}`,
            meta: { cityName: c.name, countryName: countryLabelEs || "" },
          });
        }
      }
    }
    setOriginCityOptionsByIndex((prev) => ({ ...prev, [idx]: out }));
  };

  // ----------------------
  // AIRPORTS via Amadeus (sanitized keyword + proper state update)
  // ----------------------
  // small wrapper to call airports from non-async handlers
  const awaitFetchAirports = (cityOrKeyword, idx, type, countryCode) => {
    fetchAirports(cityOrKeyword, idx, type, countryCode).catch((err) => {
      console.error("fetchAirports wrapper error", err);
    });
  };

  // fetch airports: prefer by countryCode + cityName (no free-text keyword)
  const fetchAirports = async (
    keywordOrCityName,
    idx,
    type = "destination",
    countryCode
  ) => {
    if (!keywordOrCityName && !countryCode) return;
    setAirportsLoadingMap((prev) => ({ ...prev, [idx]: true }));
    try {
      // If countryCode is known, ask AMADEUS for airports by country and optionally filter by city
      if (countryCode) {
        // flightsApi.getAirportOptionsForSelect supports (keyword, limit, countryCode, cityName)
        const items = await flightsApi.getAirportOptionsForSelect(
          "",
          200,
          countryCode,
          keywordOrCityName || ""
        );
        setAirportOptionsByIndex((prev) => ({
          ...prev,
          [idx]: { ...(prev[idx] || {}), [type]: items || [] },
        }));
        return;
      }

      // fallback: call the usual keyword search
      const items = await flightsApi.getAirportOptionsForSelect(
        keywordOrCityName,
        200
      );
      setAirportOptionsByIndex((prev) => ({
        ...prev,
        [idx]: { ...(prev[idx] || {}), [type]: items || [] },
      }));
    } catch (err) {
      console.error("Error fetching airports for", keywordOrCityName, err);
      setAirportOptionsByIndex((prev) => ({
        ...prev,
        [idx]: { ...(prev[idx] || {}), [type]: [] },
      }));
    } finally {
      setAirportsLoadingMap((prev) => ({ ...prev, [idx]: false }));
    }
  };

  // handlers
  const handleChangeDestinationCity = (val) => {
    setDestinations((prev) => {
      const copy = [...prev];
      copy[currentDestinationIndex] = {
        ...copy[currentDestinationIndex],
        city: val,
        destinationAirport: null,
        flightOffers: [],
        selectedFlight: null,
      };
      return copy;
    });

    // nombre de la ciudad para la búsqueda (nunca uses el label localizado para filtrado)
    const cityName =
      val?.meta?.cityName ||
      val?.city ||
      (val?.label ? val.label.split(",")[0].trim() : "") ||
      val?.value ||
      "";

    // preferir countryCode si está en la opción, si no, intentar resolver desde nombre
    const countryCode =
      val?.countryCode ||
      (val?.country ? COUNTRY_NAME_TO_CODE[val.country] : undefined) ||
      undefined;

    // solicitar aeropuertos de tipo 'destination'
    awaitFetchAirports(
      cityName,
      currentDestinationIndex,
      "destination",
      countryCode
    );
  };

  // Store the react-select option object (so the Select shows the selected value).
  const handleChangeOriginCountry = (option) => {
    setDestinations((prev) => {
      const copy = [...prev];
      copy[currentDestinationIndex] = {
        ...copy[currentDestinationIndex],
        originCountry: option,
        originCity: null,
        originAirport: null,
        flightOffers: [],
        selectedFlight: null,
      };
      return copy;
    });
    setAirportOptionsByIndex((prev) => ({
      ...prev,
      [currentDestinationIndex]: {
        ...(prev[currentDestinationIndex] || {}),
        origin: [],
      },
    }));
    setOriginCityOptionsByIndex((prev) => ({
      ...prev,
      [currentDestinationIndex]: [],
    }));
  };

  const handleChangeOriginCity = (val) => {
    setDestinations((prev) => {
      const copy = [...prev];
      copy[currentDestinationIndex] = {
        ...copy[currentDestinationIndex],
        originCity: val,
        originAirport: null,
        flightOffers: [],
        selectedFlight: null,
      };
      return copy;
    });
    const cityName =
      val?.meta?.cityName ||
      val?.meta?.countryName ||
      val?.label ||
      val?.value ||
      "";
    const originCountryName = getCountryName(
      destinations[currentDestinationIndex]?.originCountry || ""
    );
    const countryCode = COUNTRY_NAME_TO_CODE[originCountryName] || undefined;
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

  // helpers for formatting flight offers
  const parseISODuration = (iso) => {
    if (!iso || typeof iso !== "string") return "";
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!m) return "";
    const hh = m[1] ? `${parseInt(m[1], 10)}h` : "";
    const mm = m[2] ? `${parseInt(m[2], 10)}m` : "";
    return [hh, mm].filter(Boolean).join(" ");
  };

  const AIRLINE_NAMES = {
    AZ: "ITA Airways",
    IB: "Iberia",
    UX: "Air Europa",
    LH: "Lufthansa",
    AF: "Air France",
    AA: "American Airlines",
    DL: "Delta",
    UA: "United Airlines",
    KL: "KLM",
    VY: "Vueling",
    // add more as you need...
  };

  // flight offers effect — updated to include meta info (flight code, airline, duration, stops)
  useEffect(() => {
    const idx = currentDestinationIndex;
    const dest = destinations[idx];
    if (!dest) return;

    const originCode = dest.originAirport?.value;
    const destCode = dest.destinationAirport?.value;
    const depDate = dest.startDate ? dest.startDate : null;

    if (!originCode || !destCode || !depDate) {
      if (dest.flightOffers && dest.flightOffers.length > 0) {
        setDestinations((prev) => {
          const copy = [...prev];
          copy[idx] = {
            ...copy[idx],
            flightOffers: [],
            offersLoading: false,
            selectedFlight: null,
          };
          return copy;
        });
      }
      return;
    }

    let mounted = true;
    (async () => {
      setDestinations((prev) => {
        const copy = [...prev];
        copy[idx] = {
          ...copy[idx],
          offersLoading: true,
          flightOffers: [],
          selectedFlight: null,
        };
        return copy;
      });

      try {
        const res = await flightsApi.searchFlights({
          originLocationCode: originCode,
          destinationLocationCode: destCode,
          departureDate: depDate,
          adults: 1,
          max: 12,
          travelClass: "ECONOMY",
        });

        if (!mounted) return;

        const offers = (res?.data || []).map((offer, i) => {
          const price = offer?.price?.total
            ? `${offer.price.total} ${offer.price.currency || ""}`
            : "Precio N/A";
          const itinerary =
            Array.isArray(offer.itineraries) && offer.itineraries[0];
          let dep = "";
          let arr = "";
          let flightCodeStr = "";
          let carrierCodes = [];
          let airlineDisplay = "";
          let stops = 0;
          let durationStr = "";

          if (
            itinerary &&
            Array.isArray(itinerary.segments) &&
            itinerary.segments.length > 0
          ) {
            const segments = itinerary.segments;
            const firstSeg = segments[0];
            const lastSeg = segments[segments.length - 1];

            dep =
              firstSeg?.departure?.at || firstSeg?.departure?.iataCode || "";
            arr = lastSeg?.arrival?.at || lastSeg?.arrival?.iataCode || "";

            stops = Math.max(0, segments.length - 1);

            const carrier =
              firstSeg?.carrierCode || firstSeg?.operating?.carrierCode || "";
            const number =
              firstSeg?.number ||
              firstSeg?.flightNumber ||
              firstSeg?.operating?.number ||
              "";
            carrierCodes = (segments || [])
              .map((s) => s.carrierCode || s.operating?.carrierCode)
              .filter(Boolean);

            if (carrier)
              flightCodeStr = carrier + (number ? String(number) : "");
            airlineDisplay =
              firstSeg?.operating?.carrierName ||
              firstSeg?.carrierName ||
              AIRLINE_NAMES[carrier] ||
              carrier;

            durationStr = parseISODuration(
              itinerary.duration || offer?.itineraries?.[0]?.duration || ""
            );
          }

          const times =
            dep && arr
              ? `${dep.split("T")[1]?.slice(0, 5) || ""} → ${arr.split("T")[1]?.slice(0, 5) || ""
              }`
              : "";
          const label = `${price}${times ? " · " + times : ""}${flightCodeStr ? " · " + flightCodeStr : ""
            }${airlineDisplay ? " · " + airlineDisplay : ""}`;

          return {
            id: offer?.id || `offer_${i}`,
            label,
            raw: offer,
            meta: {
              price,
              times,
              flightCode: flightCodeStr,
              carrierCodes,
              airline: airlineDisplay,
              stops,
              duration: durationStr,
            },
          };
        });

        setDestinations((prev) => {
          const copy = [...prev];
          copy[idx] = {
            ...copy[idx],
            flightOffers: offers,
            offersLoading: false,
          };
          return copy;
        });
      } catch (err) {
        console.error("Error fetching flight offers", err);
        setDestinations((prev) => {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], flightOffers: [], offersLoading: false };
          return copy;
        });
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentDestinationIndex,
    destinations[currentDestinationIndex]?.originAirport?.value,
    destinations[currentDestinationIndex]?.destinationAirport?.value,
    destinations[currentDestinationIndex]?.startDate
      ? destinations[currentDestinationIndex].startDate.toISOString()
      : null,
  ]);

  const handleSelectFlight = (opt) => {
    setDestinations((prev) => {
      const copy = [...prev];
      const current = { ...(copy[currentDestinationIndex] || {}) };
      current.selectedFlight = opt;
      copy[currentDestinationIndex] = current;
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
        alert("Usuario no identificado. Inicia sesión nuevamente.");
        nav("/login");
        return;
      }

      if (!pace) throw new Error("Selecciona el ritmo del viaje (pace).");

      let createdTripId = null;

      const placesArray = placesText
        .split(/[,;\n]+/)
        .map((p) => p.trim())
        .filter(Boolean);

      for (const dest of destinations) {
        if (!dest.city || !dest.startDate || !dest.endDate)
          throw new Error("Por favor completa todos los destinos y fechas.");
        if (!dest.originAirport || !dest.destinationAirport)
          throw new Error(
            "Seleccioná origen y destino (aeropuertos) para cada destino."
          );

        // --- reemplazar where you build `payload` ---
        const destObj = dest.city || {};
        // nombre de ciudad en forma 'neutral' (usa destObj.city si existe, si no intenta sacar del label)
        const destCityNameEn =
          (typeof destObj === "string" ? destObj : destObj.city) ||
          (typeof destObj === "object" && destObj.label
            ? destObj.label.split(",")[0].trim()
            : "") ||
          "";

        // país en inglés (según tu cityOptions tiene country en inglés)
        const destCountryEn =
          typeof destObj === "object" && destObj.country ? destObj.country : "";

        // destination en inglés que enviaremos al backend
        const destinationForApi =
          destCityNameEn + (destCountryEn ? `, ${destCountryEn}` : "");

        const payload = {
          destination: destinationForApi, // <-- ahora "Barcelona, Spain"
          start_date: dest.startDate,
          end_date: dest.endDate,
          notes: notes || null,
        };

        setStatusMessage(`Creando viaje a ${payload.destination} ...`);
        const t = await apiPost("/trips", payload);
        if (!t || !t.trip || !t.trip.id)
          throw new Error("No se pudo crear el viaje");
        createdTripId = t.trip.id;

        try {
          // Build a canonical flight identifier (prefer carrier+number + date).
          // Example canonical formats: "KL1512|2023-08-01" (preferred) or "KL1512" if no date.
          const sel = dest.selectedFlight;
          let canonicalFlightId = null;

          if (sel) {
            const datePart = dest.startDate
              ? dest.startDate.toISOString().split("T")[0]
              : "";

            // 1) Prefer explicitly provided meta.flightCode (e.g. "KL1512")
            const metaCode = sel?.meta?.flightCode;
            if (metaCode && String(metaCode).trim()) {
              const clean = String(metaCode).replace(/\s+/g, "").toUpperCase();
              canonicalFlightId = datePart ? `${clean}|${datePart}` : clean;
            } else if (sel?.raw) {
              // 2) Try to derive from the raw offer shape: first itinerary -> first segment
              const raw = sel.raw;
              const itinerary = Array.isArray(raw.itineraries) && raw.itineraries[0];
              const firstSeg = itinerary && Array.isArray(itinerary.segments) ? itinerary.segments[0] : null;

              const carrier =
                firstSeg?.carrierCode ||
                firstSeg?.operating?.carrierCode ||
                raw?.flightDesignator?.carrierCode ||
                "";
              const number =
                firstSeg?.number ||
                firstSeg?.flightNumber ||
                raw?.flightDesignator?.flightNumber ||
                "";

              if (carrier && number) {
                const clean = `${String(carrier).toUpperCase()}${String(number)}`;
                canonicalFlightId = datePart ? `${clean}|${datePart}` : clean;
              } else if (sel?.id) {
                // 3) fallback: keep existing id if we can't parse a carrier/number
                canonicalFlightId = sel.id;
              } else if (sel?.raw?.id) {
                canonicalFlightId = sel.raw.id;
              }
            }
          }

          if (canonicalFlightId) {
            setStatusMessage(`Guardando vuelo ${canonicalFlightId}...`);
            await apiPost("/flights", {
              flight_id: canonicalFlightId,
              trip_id: createdTripId,
            });
            setStatusMessage(`Vuelo ${canonicalFlightId} guardado.`);
          }

        } catch (err) {
          console.error("Error guardando vuelo:", err);
        }

        setStatusMessage(
          "Generando itinerario automáticamente (esto puede tardar unos segundos) ..."
        );

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
        setStatusMessage("Itinerario generado y guardado!");
      }

      if (createdTripId)
        nav("/load-trip", { state: { tripId: createdTripId } });
    } catch (err) {
      console.error("Error creando viaje:", err);
      alert(err.message || "Ocurrió un error al crear el viaje.");
    } finally {
      setLoadingTrip(false);
      setStatusMessage(null);
    }
  };

  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const weekDays = ["DOM", "LUN", "MAR", "MIE", "JUE", "VIE", "SAB"];

  if (loading) {
    return (
      <div className="trip-it-root">
        <main
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "80vh",
          }}
        >
          <div style={{ fontSize: 25 }}>Cargando…</div>
        </main>
      </div>
    );
  }

  const originCityOptions =
    originCityOptionsByIndex[currentDestinationIndex] || [];
  const originAirportOptions =
    (airportOptionsByIndex[currentDestinationIndex] || {}).origin || [];
  const destAirportOptions =
    (airportOptionsByIndex[currentDestinationIndex] || {}).destination || [];

  // helper used by react-select to render flight options nicely
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
        <div style={{ fontWeight: 700 }}>{m.price || option.label}</div>
        <div style={{ textAlign: "right", fontSize: 13, color: "#333" }}>
          {m.times && <div style={{ marginBottom: 2 }}>{m.times}</div>}
          <div>
            {m.flightCode && (
              <span style={{ fontWeight: 600 }}>{m.flightCode}</span>
            )}
            {m.airline && (
              <span style={{ marginLeft: 8, color: "#777" }}>{m.airline}</span>
            )}
          </div>
          <div style={{ color: "#666", fontSize: 12 }}>
            {(m.stops || m.duration) &&
              `${m.stops ? `${m.stops} stop${m.stops > 1 ? "s" : ""}` : ""}${m.stops && m.duration ? " · " : ""
              }${m.duration || ""}`}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="add-trip-root">
      <div className="add-trip-container">
        <div className="add-trip-left">
          <form className="form" onSubmit={handleSubmit}>
            {/* SECTION: Destination */}
            <section className="card">
              <h3>Destino y Fechas</h3>

              <label>Ciudad de destino</label>
              <Select
                options={cityOptions}
                value={currentDestination.city}
                onChange={handleChangeDestinationCity}
                placeholder="Selecciona ciudad de destino"
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
                        currentDate < today || alreadySelected(currentDate);
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
                          className={`day ${inRange || start || end ? "selected-day" : ""
                            }`}
                          onClick={() => !isPast && handleDateSelect(day.date)}
                          disabled={isPast}
                          style={{
                            borderTopLeftRadius: end || inRange ? "0" : "90px",
                            borderBottomLeftRadius:
                              end || inRange ? "0" : "90px",
                            borderTopRightRadius:
                              start || inRange ? "0" : "90px",
                            borderBottomRightRadius:
                              start || inRange ? "0" : "90px",
                          }}
                        >
                          {day.date}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {currentDestination.startDate && currentDestination.endDate && (
                  <p className="date-range" style={{ marginTop: 8 }}>
                    Viaje a {currentDestination.city?.label || ""} del{" "}
                    {currentDestination.startDate.getDate()}/
                    {currentDestination.startDate.getMonth() + 1}/
                    {currentDestination.startDate.getFullYear()} al{" "}
                    {currentDestination.endDate.getDate()}/
                    {currentDestination.endDate.getMonth() + 1}/
                    {currentDestination.endDate.getFullYear()}
                  </p>
                )}
              </div>
            </section>

            {/* SECTION: Flight selection */}
            <section className="card card--white">
              <h3>Vuelos</h3>

              <div className="flights-grid">
                <div className="field">
                  <label>País de origen</label>
                  <Select
                    className="dropdown-select"
                    classNamePrefix="react-select"
                    options={countryOptions}
                    value={currentDestination.originCountry || null}
                    onChange={(val) => handleChangeOriginCountry(val)}
                    placeholder="Selecciona el pais de origen"
                    isDisabled={loading}
                  />
                </div>

                <div className="field">
                  <label>Ciudad de origen (escribe para buscar)</label>
                  <Select
                    className="dropdown-select"
                    classNamePrefix="react-select"
                    options={originCityOptions}
                    value={currentDestination.originCity}
                    onChange={handleChangeOriginCity}
                    onInputChange={(inputValue) => {
                      // local city search; we call fetchOriginCityOptions but immediately return input for react-select
                      fetchOriginCityOptions(
                        String(inputValue || ""),
                        currentDestinationIndex
                      );
                      return inputValue;
                    }}
                    placeholder={
                      currentDestination.originCountry
                        ? "Escribe mínimo 2 letras para buscar ciudad"
                        : "Seleccioná país primero"
                    }
                    isClearable
                    noOptionsMessage={() => "Escribe para buscar ciudades"}
                    isDisabled={!currentDestination.originCountry}
                  />
                </div>

                <div className="field">
                  <label>Aeropuerto de origen</label>
                  <Select
                    className="dropdown-select"
                    classNamePrefix="react-select"
                    options={originAirportOptions}
                    value={currentDestination.originAirport}
                    onChange={(opt) => handleChangeAirport("origin", opt)}
                    placeholder={
                      airportsLoadingMap[currentDestinationIndex]
                        ? "Cargando aeropuertos..."
                        : "Selecciona aeropuerto de origen"
                    }
                    isClearable
                    isDisabled={
                      airportsLoadingMap[currentDestinationIndex] ||
                      !currentDestination.originCity
                    }
                  />
                </div>

                <div className="field">
                  <label>Aeropuerto de destino</label>
                  <Select
                    className="dropdown-select"
                    classNamePrefix="react-select"
                    options={destAirportOptions}
                    value={currentDestination.destinationAirport}
                    onChange={(opt) => handleChangeAirport("destination", opt)}
                    placeholder={
                      airportsLoadingMap[currentDestinationIndex]
                        ? "Cargando aeropuertos..."
                        : "Selecciona aeropuerto de destino"
                    }
                    isClearable
                    isDisabled={
                      airportsLoadingMap[currentDestinationIndex] ||
                      !currentDestination.city
                    }
                  />
                </div>

                <div className="field wide">
                  <label>Vuelos disponibles (según día elegido)</label>
                  <Select
                    className="dropdown-select"
                    classNamePrefix="react-select"
                    options={currentDestination.flightOffers || []}
                    value={currentDestination.selectedFlight}
                    onChange={handleSelectFlight}
                    placeholder={
                      currentDestination.offersLoading
                        ? "Buscando vuelos..."
                        : "Seleccioná un vuelo (si hay)"
                    }
                    isClearable
                    isDisabled={
                      currentDestination.offersLoading ||
                      !(currentDestination.flightOffers?.length > 0)
                    }
                    // nicer rendering: price left, times / code / airline on right
                    formatOptionLabel={(option, { context }) =>
                      renderFlightOption(option)
                    }
                    // ensure selected value shows the same layout
                    isOptionSelected={(option, value) =>
                      option.id === value?.id
                    }
                  />
                </div>
              </div>
            </section>

            {/* SECTION: Preferences */}
            <section className="card">
              <h3>Preferencias</h3>

              <label>Ritmo del viaje</label>
              <Select
                className="dropdown-select"
                classNamePrefix="react-select"
                placeholder="-- Selecciona ritmo --"
                options={[
                  { value: "Relajado", label: "Relajado" },
                  { value: "Moderado", label: "Moderado" },
                  { value: "Intenso", label: "Intenso" },
                ]}
                value={pace ? { value: pace, label: pace } : null}
                onChange={(option) => setPace(option.value)}
                isSearchable={false}
              />

              <label style={{ marginTop: 10 }}>
                Lugares que querés incluir (opcional)
              </label>
              <textarea
                value={placesText}
                className="textarea"
                onChange={(e) => setPlacesText(e.target.value)}
                rows={3}
                placeholder="Escribe nombres separados por comas o por línea."
              />

              <label style={{ marginTop: 10 }}>
                Notas del viaje (opcional)
              </label>
              <textarea
                value={notes}
                className="textarea"
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Información que quieras que tenga en cuenta el generador."
              />
            </section>

            {statusMessage && (
              <div style={{ marginBottom: 12, color: "#333" }}>
                {statusMessage}
              </div>
            )}

            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="submit"
                className="btn-primary create-trip"
                disabled={loadingTrip}
              >
                {loadingTrip
                  ? "Creando y generando itinerario..."
                  : "Armar Viaje"}
              </button>
              <button
                type="button"
                className="btn-secondary add-destination"
                onClick={handleAddDestination}
              >
                + Agregar otro destino
              </button>
            </div>
          </form>
        </div>

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
