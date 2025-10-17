import React, { useState, useMemo, useEffect } from 'react';  
import { apiPost, apiGet, apiPut } from "./api";
import { useNavigate } from 'react-router-dom';
import '../styles/AddTrip.css';
import LogoSvg from '../components/LogoSvg';
import Select from 'react-select';
import Header from "../components/Header";
import flightsApi from '../services/flightsApi';
import { Country, City } from 'country-state-city';

export default function AddTrip() {
  // small ISO map for a few countries used in UI (kept for destination city handling)
  const COUNTRY_NAME_TO_CODE = {
    'Spain': 'ES',
    'Argentina': 'AR',
    'Italy': 'IT',
    'Germany': 'DE',
    'France': 'FR'
  };

  const [destinations, setDestinations] = useState([{
    city: null,
    startDate: null,
    endDate: null,
    originCountry: null, // now store ISO2 codes (e.g. 'AR', 'ES')
    originCity: null,
    originAirport: null,
    destinationAirport: null,
    flightOffers: [],
    offersLoading: false,
    selectedFlight: null
  }]);

  const [currentDestinationIndex, setCurrentDestinationIndex] = useState(0);
  const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
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

  const cityOptions = useMemo(() => ([
    { value: 'barcelona_spain', label: 'Barcelona, Spain', city: 'Barcelona', country: 'Spain' },
    { value: 'buenosaires_argentina', label: 'Buenos Aires, Argentina', city: 'Buenos Aires', country: 'Argentina' },
    { value: 'rome_italy', label: 'Rome, Italy', city: 'Rome', country: 'Italy' },
    { value: 'berlin_germany', label: 'Berlin, Germany', city: 'Berlin', country: 'Germany' },
    { value: 'paris_france', label: 'Paris, France', city: 'Paris', country: 'France' },
  ]), []);

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
          const sorted = [...res].sort((a, b) => normalizeDate(b.start_date) - normalizeDate(a.start_date));
          const Dates = sorted.map(trip => ({ start_date: normalizeDate(trip.start_date), end_date: normalizeDate(trip.end_date) }));
          setTripsDates(Dates);
        }
      } catch (err) {
        console.error("Error cargando viajes:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

  const generateCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const days = [];
    for (let i = 1; i <= daysInMonth; i++) days.push({ date: i, selected: false });
    return { days, firstDayOfMonth };
  };

  const { days, firstDayOfMonth } = generateCalendarDays();

  const alreadySelected = (d) => {
    if (!d) return false;
    return tripsDates.some(trip => {
      const start = new Date(trip.start_date);
      const end = new Date(trip.end_date);
      if (currentDestination.startDate) {
        if (currentDestination.startDate < start && d > currentDestination.startDate) return d >= start;
        else if (currentDestination.startDate > end && currentDestination.startDate > d) return d <= end;
      }
      return d >= start && d <= end;
    });
  };

  const handleDateSelect = (day) => {
    const selectedDate = new Date(currentYear, currentMonth, day);
    if (selectedDate < today || alreadySelected(selectedDate)) return;

    setDestinations(prev => {
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
    if (!current.endDate) return start.getTime() === currentDate.getTime();
    const end = current.endDate;
    return currentDate.getTime() >= start.getTime() && currentDate.getTime() <= end.getTime();
  };

  const handlePrevMonth = () => setCurrentMonth(prev => prev === 0 ? (setCurrentYear(c => c - 1), 11) : prev - 1);
  const handleNextMonth = () => setCurrentMonth(prev => prev === 11 ? (setCurrentYear(c => c + 1), 0) : prev + 1);

  const handleAddDestination = () => {
    setDestinations(prev => {
      const newDest = [...prev, {
        city: null, startDate: null, endDate: null,
        originCountry: null, originCity: null, originAirport: null, destinationAirport: null,
        flightOffers: [], offersLoading: false, selectedFlight: null
      }];
      setCurrentDestinationIndex(newDest.length - 1);
      return newDest;
    });
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  // parse helper (used for airport option parsing)
  const parseCityCountryFromOption = (opt) => {
    const cityName = (opt?.meta?.cityName || opt?.cityName || '')?.trim();
    const countryName = (opt?.meta?.countryName || opt?.countryName || '')?.trim();
    if (cityName || countryName) return { cityName, countryName };

    const label = opt?.label || '';
    const m = label.match(/\(([^)]+)\)/);
    if (m && m[1]) {
      const parts = m[1].split(',').map(p => p.trim());
      if (parts.length >= 2) {
        return { cityName: parts[0], countryName: parts[parts.length - 1] };
      } else if (parts.length === 1) {
        return { cityName: parts[0], countryName: '' };
      }
    }
    return { cityName: '', countryName: '' };
  };

  const reactSelectStyles = {
    control: (provided) => ({
      ...provided,
      minHeight: '44px',
      borderRadius: '8px',
      border: '1px solid #e8d1d1',
      boxShadow: 'none',
      background: '#fcf7f7'
    }),
    valueContainer: (p) => ({ ...p, padding: '4px 8px' }),
    input: (p) => ({ ...p, margin: 0 }),
    placeholder: (p) => ({ ...p, margin: 0, color: '#777' }),
    menu: (p) => ({ ...p, zIndex: 9999 })
  };

  // ----------------------
  // COUNTRY OPTIONS (react-select) - Spanish labels
  // ----------------------
  const countryIntlDisplay = useMemo(() => {
    // Intl.DisplayNames may not exist in very old browsers; fallback to returning iso -> english name from library
    try {
      return new Intl.DisplayNames(['es'], { type: 'region' });
    } catch (e) {
      return null;
    }
  }, []);

  const countryOptions = useMemo(() => {
    const all = Country.getAllCountries() || [];
    return all.map(c => {
      const iso = c.isoCode;
      let label;
      try {
        label = countryIntlDisplay ? countryIntlDisplay.of(iso) : c.name;
      } catch (e) {
        label = c.name;
      }
      return { value: iso, label };
    }).sort((a,b) => a.label.localeCompare(b.label, 'es'));
  }, [countryIntlDisplay]);

  // ----------------------
  // CITY AUTOCOMPLETE (local country-state-city)
  // ----------------------
  const fetchOriginCityOptions = (input, idx) => {
    const safeInput = typeof input === 'string' ? input.trim() : String(input || '');
    if (!safeInput || safeInput.length < 2) {
      setOriginCityOptionsByIndex(prev => ({ ...prev, [idx]: [] }));
      return;
    }

    const originCountryIso = destinations[idx]?.originCountry || null; // expects ISO2 now
    if (!originCountryIso) {
      setOriginCityOptionsByIndex(prev => ({ ...prev, [idx]: [] }));
      return;
    }

    const allCountries = Country.getAllCountries();
    const found = allCountries.find(c => c.isoCode === originCountryIso);
    const isoCode = found?.isoCode || null;
    if (!isoCode) {
      setOriginCityOptionsByIndex(prev => ({ ...prev, [idx]: [] }));
      return;
    }

    let cities = [];
    try { cities = City.getCitiesOfCountry(isoCode) || []; } catch (e) { cities = []; }

    const q = safeInput.toLowerCase();
    const seen = new Set();
    const out = [];
    for (let i = 0; i < cities.length && out.length < 100; i++) {
      const c = cities[i];
      if (!c || !c.name) continue;
      if (c.name.toLowerCase().includes(q)) {
        const key = `${c.name}|||${found?.name || ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({
            value: key,
            label: `${c.name}${found?.name ? ', ' + (countryIntlDisplay ? countryIntlDisplay.of(found.isoCode) : found.name) : ''}`,
            meta: { cityName: c.name, countryName: found?.name || '' }
          });
        }
      }
    }
    setOriginCityOptionsByIndex(prev => ({ ...prev, [idx]: out }));
  };

  // ----------------------
  // AIRPORTS (via flightsApi -> OurAirports)
  // ----------------------
  // small wrapper to call airports from non-async handlers
  const awaitFetchAirports = (cityOrKeyword, idx, type, countryCode) => {
    fetchAirports(cityOrKeyword, idx, type, countryCode).catch(err => {
      console.error('fetchAirports wrapper error', err);
    });
  };

  // fetch airports: prefer by countryCode + cityName (no free-text keyword)
  const fetchAirports = async (keywordOrCityName, idx, type = 'destination', countryCode) => {
    if (!keywordOrCityName && !countryCode) return;
    setAirportsLoadingMap(prev => ({ ...prev, [idx]: true }));
    try {
      // flightsApi.getAirportOptionsForSelect supports (keyword, limit, countryCode, cityName)
      if (countryCode) {
        const items = await flightsApi.getAirportOptionsForSelect('', 200, countryCode, keywordOrCityName || '');
        setAirportOptionsByIndex(prev => ({
          ...prev,
          [idx]: { ...(prev[idx] || {}), [type]: items || [] }
        }));
        return;
      }

      // fallback: call the usual keyword search
      const items = await flightsApi.getAirportOptionsForSelect(keywordOrCityName, 200);
      setAirportOptionsByIndex(prev => ({
        ...prev,
        [idx]: { ...(prev[idx] || {}), [type]: items || [] }
      }));
    } catch (err) {
      console.error('Error fetching airports for', keywordOrCityName, err);
      setAirportOptionsByIndex(prev => ({ ...prev, [idx]: { ...(prev[idx] || {}), [type]: [] } }));
    } finally {
      setAirportsLoadingMap(prev => ({ ...prev, [idx]: false }));
    }
  };

  // handlers
  const handleChangeDestinationCity = (val) => {
    setDestinations(prev => {
      const copy = [...prev];
      copy[currentDestinationIndex] = { ...copy[currentDestinationIndex], city: val, destinationAirport: null, flightOffers: [], selectedFlight: null };
      return copy;
    });
    const cityName = val?.city || val?.label || val?.value || '';
    const countryName = val?.country || '';
    const countryCode = COUNTRY_NAME_TO_CODE[countryName] || undefined;
    // call airports by country+city when we have countryCode, else fallback to keyword
    awaitFetchAirports(cityName || (val?.label || ''), currentDestinationIndex, 'destination', countryCode);
  };

  // origin country now stores ISO2 code
  const handleChangeOriginCountry = (selected) => {
    // selected is object { value: iso, label: spanishName } or null
    const iso = selected ? selected.value : null;
    setDestinations(prev => {
      const copy = [...prev];
      copy[currentDestinationIndex] = { ...copy[currentDestinationIndex], originCountry: iso, originCity: null, originAirport: null, flightOffers: [], selectedFlight: null };
      return copy;
    });
    setAirportOptionsByIndex(prev => ({ ...prev, [currentDestinationIndex]: { ...(prev[currentDestinationIndex] || {}), origin: [] } }));
    setOriginCityOptionsByIndex(prev => ({ ...prev, [currentDestinationIndex]: [] }));
  };

  const handleChangeOriginCity = (val) => {
    setDestinations(prev => {
      const copy = [...prev];
      copy[currentDestinationIndex] = { ...copy[currentDestinationIndex], originCity: val, originAirport: null, flightOffers: [], selectedFlight: null };
      return copy;
    });
    const cityName = val?.meta?.cityName || val?.meta?.countryName || val?.label || val?.value || '';
    const originCountryIso = destinations[currentDestinationIndex]?.originCountry || '';
    const countryCode = originCountryIso || undefined; // now pass ISO2 directly
    awaitFetchAirports(cityName, currentDestinationIndex, 'origin', countryCode);
  };

  const handleChangeAirport = (which, opt) => {
    setDestinations(prev => {
      const copy = [...prev];
      const current = { ...(copy[currentDestinationIndex] || {}) };
      if (which === 'origin') current.originAirport = opt;
      else current.destinationAirport = opt;
      current.flightOffers = [];
      current.selectedFlight = null;
      copy[currentDestinationIndex] = current;
      return copy;
    });
  };

  // helpers for formatting flight offers
  const parseISODuration = (iso) => {
    if (!iso || typeof iso !== 'string') return '';
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!m) return '';
    const hh = m[1] ? `${parseInt(m[1],10)}h` : '';
    const mm = m[2] ? `${parseInt(m[2],10)}m` : '';
    return [hh, mm].filter(Boolean).join(' ');
  };

  // flight offers effect — updated to use Amadeus-backed offers (normalized earlier)
  useEffect(() => {
    const idx = currentDestinationIndex;
    const dest = destinations[idx];
    if (!dest) return;

    const originCode = dest.originAirport?.value;
    const destCode = dest.destinationAirport?.value;
    const depDate = dest.startDate ? dest.startDate : null;

    if (!originCode || !destCode || !depDate) {
      if (dest.flightOffers && dest.flightOffers.length > 0) {
        setDestinations(prev => {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], flightOffers: [], offersLoading: false, selectedFlight: null };
          return copy;
        });
      }
      return;
    }

    let mounted = true;
    (async () => {
      setDestinations(prev => {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], offersLoading: true, flightOffers: [], selectedFlight: null };
        return copy;
      });

      try {
        const res = await flightsApi.searchFlights({
          originLocationCode: originCode,
          destinationLocationCode: destCode,
          departureDate: depDate,
          adults: 1,
          max: 12,
          travelClass: 'ECONOMY'
        });

        if (!mounted) return;

        // NOTE: when using Amadeus raw results, flightsApi.searchFlights should return normalized offers
        // similar to the earlier Aviationstack normalization. If it returns raw Amadeus data, adjust mapping here.
        const rawOffers = res?.data || res?.results || res || [];
        const offers = (rawOffers || []).map((offer, i) => {
          // attempt to read normalized structure if already provided
          if (offer && offer.itineraries) {
            // already normalized (from flightsApi)
            const itinerary = Array.isArray(offer.itineraries) && offer.itineraries[0];
            const segments = (itinerary && Array.isArray(itinerary.segments)) ? itinerary.segments : [];
            const firstSeg = segments[0] || {};
            const lastSeg = segments[segments.length - 1] || firstSeg || {};
            const dep = firstSeg?.departure?.at || firstSeg?.departure?.iataCode || '';
            const arr = lastSeg?.arrival?.at || lastSeg?.arrival?.iataCode || '';
            const times = (dep && arr) ? `${(dep.split('T')[1] || dep).slice(0,5)} → ${(arr.split('T')[1] || arr).slice(0,5)}` : '';
            const stops = Math.max(0, segments.length - 1);
            const carrier = firstSeg?.carrierCode || firstSeg?.carrier || (offer.flight?.iataNumber ? offer.flight.iataNumber.replace(/\d+/g, '') : '');
            const number = firstSeg?.number || offer.flight?.number || '';
            const flightCodeStr = (carrier || '') + (number ? String(number) : '');
            const airlineDisplay = offer?.raw?.airline?.name || firstSeg?.operating?.carrierName || firstSeg?.carrierName || carrier || '';
            let durationStr = firstSeg?.duration || '';
            if (!durationStr && itinerary && itinerary.duration) durationStr = parseISODuration(itinerary.duration);
            const label = `${flightCodeStr ? flightCodeStr + ' · ' : ''}${airlineDisplay || offer.label || ''}`;

            return {
              id: offer?.id || `offer_${i}`,
              label,
              raw: offer,
              meta: {
                times,
                flightCode: flightCodeStr,
                carrierCodes: segments.map(s => s.carrierCode || s.carrier || '').filter(Boolean),
                airline: airlineDisplay,
                stops,
                duration: durationStr
              }
            };
          }

          // if Amadeus raw format: attempt to map a common brief form
          // Amadeus flight-offers responses typically contain .data array with offers; try to support both types
          const offerData = offer || {};
          // try to read id, itinerary
          const id = offerData.id || offerData.flightId || `offer_${i}`;
          // attempt to extract first segment times (deep within offerData.itineraries or offerData.itineraries[0].segments)
          let firstSeg = {};
          let lastSeg = {};
          try {
            const itins = offerData.itineraries || offerData.itinerary || [];
            const segs = (Array.isArray(itins) && itins[0] && Array.isArray(itins[0].segments)) ? itins[0].segments : (offerData.segments || []);
            firstSeg = segs[0] || {};
            lastSeg = segs[segs.length - 1] || firstSeg || {};
          } catch (e) {
            firstSeg = {};
            lastSeg = {};
          }
          const dep = firstSeg?.departure?.at || firstSeg?.departure?.iataCode || firstSeg?.departure?.departure || '';
          const arr = lastSeg?.arrival?.at || lastSeg?.arrival?.iataCode || lastSeg?.arrival?.arrival || '';
          const times = (dep && arr) ? `${(String(dep).split('T')[1] || dep).slice(0,5)} → ${(String(arr).split('T')[1] || arr).slice(0,5)}` : '';
          const stops = 0;
          const airlineDisplay = (offerData?.validatingAirlineCodes && offerData.validatingAirlineCodes[0]) || (offerData?.carrierName) || '';
          const label = `${airlineDisplay ? airlineDisplay + ' · ' : ''}${offerData?.summary || offerData?.label || id}`;

          return {
            id,
            label,
            raw: offerData,
            meta: {
              times,
              flightCode: offerData?.flightCode || '',
              carrierCodes: offerData?.validatingAirlineCodes || [],
              airline: airlineDisplay,
              stops,
              duration: offerData?.travelTime || ''
            }
          };
        });

        setDestinations(prev => {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], flightOffers: offers, offersLoading: false };
          return copy;
        });
      } catch (err) {
        console.error('Error fetching flight offers', err);
        setDestinations(prev => {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], flightOffers: [], offersLoading: false };
          return copy;
        });
      }
    })();

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentDestinationIndex,
    destinations[currentDestinationIndex]?.originAirport?.value,
    destinations[currentDestinationIndex]?.destinationAirport?.value,
    destinations[currentDestinationIndex]?.startDate ? destinations[currentDestinationIndex].startDate.toISOString() : null
  ]);

  const handleSelectFlight = (opt) => {
    setDestinations(prev => {
      const copy = [...prev];
      const current = { ...(copy[currentDestinationIndex] || {}) };
      current.selectedFlight = opt;
      copy[currentDestinationIndex] = current;
      return copy;
    });
  };

  // helper to persist flight to backend
  // Tries POST /flights; on 409 attempts PUT /flights/:flight_id to associate with trip
  const persistFlightToBackend = async (flightId, tripId) => {
    if (!flightId) return;
    try {
      await apiPost('/flights', { flight_id: String(flightId), trip_id: tripId });
      // success
      return;
    } catch (err) {
      // If flight already exists, try to associate it to the trip via PUT
      // check for conflict (409). apiPost may throw a generic Error; try to detect status
      const status = err && (err.status || (err.body && err.body.status) || (err.response && err.response.status));
      if (status === 409 || (err && String(err.message || '').includes('409'))) {
        try {
          await apiPut(`/flights/${encodeURIComponent(String(flightId))}`, { trip_id: tripId });
          return;
        } catch (uerr) {
          console.warn('Could not update existing flight with trip association:', uerr);
          return;
        }
      }
      // For other errors, log but don't block trip creation
      console.error('Error saving flight to backend:', err);
    }
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

      const placesArray = placesText.split(/[,;\n]+/).map(p => p.trim()).filter(Boolean);

      for (const dest of destinations) {
        if (!dest.city || !dest.startDate || !dest.endDate) throw new Error("Por favor completa todos los destinos y fechas.");
        if (!dest.originAirport || !dest.destinationAirport) throw new Error("Seleccioná origen y destino (aeropuertos) para cada destino.");

        const payload = {
          destination: dest.city.label,
          start_date: dest.startDate,
          end_date: dest.endDate,
          notes: notes || null
        };

        setStatusMessage(`Creando viaje a ${payload.destination} ...`);
        const t = await apiPost("/trips", payload);
        if (!t || !t.trip || !t.trip.id) throw new Error("No se pudo crear el viaje");
        createdTripId = t.trip.id;

        setStatusMessage("Generando itinerario automáticamente (esto puede tardar unos segundos) ...");

        const itineraryBody = {
          save: true,
          pace,
          places: placesArray,
          llm_notes: notes || "",
          user_id: stored.id,
          trip_id: createdTripId,
          origin_airport: dest.originAirport?.value || null,
          destination_airport: dest.destinationAirport?.value || null,
          // selected_flight: pass raw normalized/Amadeus object so backend can use it if needed
          selected_flight: dest.selectedFlight?.raw || null
        };

        await apiPost(`/trips/${createdTripId}/itinerary`, itineraryBody);
        setStatusMessage("Itinerario generado y guardado!");

        // --- Persist selected flight to /flights endpoint (if user selected one)
        try {
          const sel = dest.selectedFlight;
          // prefer a stable ID: the normalized option id, or raw.id from provider
          const flightId =
            (sel && (sel.raw && (sel.raw.id || sel.raw.flightOfferId || sel.raw.flight_id))) ||
            (sel && sel.id) ||
            null;

          if (flightId) {
            await persistFlightToBackend(flightId, createdTripId);
          }
        } catch (err) {
          // log and continue; flight persistence is best-effort
          console.error('Failed to persist selected flight for trip', err);
        }
      }

      if (createdTripId) nav("/load-trip", { state: { tripId: createdTripId } });
    } catch (err) {
      console.error("Error creando viaje:", err);
      alert(err.message || "Ocurrió un error al crear el viaje.");
    } finally {
      setLoadingTrip(false);
      setStatusMessage(null);
    }
  };

  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const weekDays = ['DOM','LUN','MAR','MIE','JUE','VIE','SAB'];

  if (loading) {
    return (
      <div className="trip-it-root">
        <Header />
        <main style={{display:'flex',justifyContent:'center',alignItems:'center',height:'80vh'}}>
          <div style={{fontSize:25}}>Cargando…</div>
        </main>
      </div>
    );
  }

  const originCityOptions = originCityOptionsByIndex[currentDestinationIndex] || [];
  const originAirportOptions = (airportOptionsByIndex[currentDestinationIndex] || {}).origin || [];
  const destAirportOptions = (airportOptionsByIndex[currentDestinationIndex] || {}).destination || [];

  // helper used by react-select to render flight options nicely
  const renderFlightOption = (option) => {
    const m = option.meta || {};
    const leftBold = m.airline ? `${m.flightCode ? m.flightCode + ' · ' : ''}${m.airline}` : option.label;
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div style={{ fontWeight: 700 }}>{leftBold}</div>
        <div style={{ textAlign: 'right', fontSize: 13, color: '#333' }}>
          {m.times && <div style={{ marginBottom: 2 }}>{m.times}</div>}
          <div>
            {m.flightCode && <span style={{ fontWeight: 600 }}>{m.flightCode}</span>}
            {m.airline && <span style={{ marginLeft: 8, color: '#777' }}>{m.airline}</span>}
          </div>
          <div style={{ color: '#666', fontSize: 12 }}>
            { (m.stops || m.duration) && `${m.stops ? `${m.stops} stop${m.stops>1?'s':''}` : ''}${(m.stops && m.duration) ? ' · ' : ''}${m.duration || ''}` }
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
                styles={reactSelectStyles}
              />

              <div style={{marginTop:12}}>
                <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                  <div style={{fontWeight:600}}>{monthNames[currentMonth]} {currentYear}</div>
                  <div>
                    <button type="button" className="arrow" onClick={handlePrevMonth}>‹</button>
                    <button type="button" className="arrow" onClick={handleNextMonth}>›</button>
                  </div>
                </div>

                <div style={{marginTop:8}} className="calendar">
                  <div className="week-days">
                    {weekDays.map((d,i)=>(<span key={i} className="week-day">{d}</span>))}
                  </div>
                  <div className="days-grid">
                    {Array(firstDayOfMonth).fill(null).map((_,i)=>(<div key={`e${i}`} className="empty-day" />))}
                    {days.map(day=>{
                      const currentDate = new Date(currentYear, currentMonth, day.date);
                      const isPast = currentDate < today || alreadySelected(currentDate);
                      const start = currentDestination?.startDate && currentDestination.startDate.getTime() === currentDate.getTime();
                      const end = currentDestination?.endDate && currentDestination.endDate.getTime() === currentDate.getTime();
                      const inRange = isDateInRange(day.date);

                      return (
                        <button key={day.date} type="button" className={`day ${inRange ? 'selected-day' : ''}`}
                                onClick={()=>!isPast && handleDateSelect(day.date)}
                                disabled={isPast}
                                style={{
                                  borderTopLeftRadius: start ? "90px" : "0",
                                  borderBottomLeftRadius: start ? "90px" : "0",
                                  borderTopRightRadius: end ? "90px" : "0",
                                  borderBottomRightRadius: end ? "90px" : "0"
                                }}>
                          {day.date}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {currentDestination.startDate && currentDestination.endDate && (
                  <p className="date-range" style={{marginTop:8}}>
                    Viaje a {currentDestination.city?.label || ''} del {currentDestination.startDate.getDate()}/{currentDestination.startDate.getMonth()+1}/{currentDestination.startDate.getFullYear()} al {currentDestination.endDate.getDate()}/{currentDestination.endDate.getMonth()+1}/{currentDestination.endDate.getFullYear()}
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
                    options={countryOptions}
                    value={countryOptions.find(c => c.value === currentDestination.originCountry) || null}
                    onChange={(opt) => handleChangeOriginCountry(opt)}
                    placeholder="Seleccioná país de origen"
                    styles={reactSelectStyles}
                    isClearable
                  />
                </div>

                <div className="field">
                  <label>Ciudad de origen (escribe para buscar)</label>
                  <Select
                    styles={reactSelectStyles}
                    options={originCityOptions}
                    value={currentDestination.originCity}
                    onChange={handleChangeOriginCity}
                    onInputChange={(inputValue) => {
                      // local city search; we call fetchOriginCityOptions but immediately return input for react-select
                      fetchOriginCityOptions(String(inputValue || ''), currentDestinationIndex);
                      return inputValue;
                    }}
                    placeholder={currentDestination.originCountry ? "Escribe mínimo 2 letras para buscar ciudad" : "Seleccioná país primero"}
                    isClearable
                    noOptionsMessage={() => 'Escribe para buscar ciudades'}
                    isDisabled={!currentDestination.originCountry}
                  />
                </div>

                <div className="field">
                  <label>Aeropuerto de origen</label>
                  <Select
                    styles={reactSelectStyles}
                    options={originAirportOptions}
                    value={currentDestination.originAirport}
                    onChange={(opt) => handleChangeAirport('origin', opt)}
                    placeholder={airportsLoadingMap[currentDestinationIndex] ? 'Cargando aeropuertos...' : 'Selecciona aeropuerto de origen'}
                    isClearable
                    isDisabled={airportsLoadingMap[currentDestinationIndex] || !currentDestination.originCity}
                  />
                </div>

                <div className="field">
                  <label>Aeropuerto de destino</label>
                  <Select
                    styles={reactSelectStyles}
                    options={destAirportOptions}
                    value={currentDestination.destinationAirport}
                    onChange={(opt) => handleChangeAirport('destination', opt)}
                    placeholder={airportsLoadingMap[currentDestinationIndex] ? 'Cargando aeropuertos...' : 'Selecciona aeropuerto de destino'}
                    isClearable
                    isDisabled={airportsLoadingMap[currentDestinationIndex] || !currentDestination.city}
                  />
                </div>

                <div className="field wide">
                  <label>Vuelos disponibles (según día elegido)</label>
                  <Select
                    styles={reactSelectStyles}
                    options={currentDestination.flightOffers || []}
                    value={currentDestination.selectedFlight}
                    onChange={handleSelectFlight}
                    placeholder={currentDestination.offersLoading ? 'Buscando vuelos...' : 'Seleccioná un vuelo (si hay)'}
                    isClearable
                    isDisabled={currentDestination.offersLoading || !(currentDestination.flightOffers?.length > 0)}
                    // nicer rendering: airline/flight code left, times/stops/duration on the right
                    formatOptionLabel={(option, { context }) => renderFlightOption(option)}
                    // ensure selected value shows the same layout
                    isOptionSelected={(option, value) => option.id === value?.id}
                  />
                </div>
              </div>
            </section>

            {/* SECTION: Preferences */}
            <section className="card">
              <h3>Preferencias</h3>

              <label>Ritmo del viaje</label>
              <select
                className="input-like"
                value={pace}
                onChange={e => setPace(e.target.value)}
              >
                <option value="">-- Selecciona ritmo --</option>
                <option value="relajado">Relajado</option>
                <option value="moderado">Moderado</option>
                <option value="intenso">Intenso</option>
              </select>

              <label style={{marginTop:10}}>Lugares que querés incluir (opcional)</label>
              <textarea
                value={placesText}
                className="textarea"
                onChange={e => setPlacesText(e.target.value)}
                rows={3}
                placeholder="Escribe nombres separados por comas o por línea."
              />

              <label style={{marginTop:10}}>Notas del viaje (opcional)</label>
              <textarea
                value={notes}
                className="textarea"
                onChange={e=>setNotes(e.target.value)}
                rows={3}
                placeholder="Información que quieras que tenga en cuenta el generador."
              />
            </section>

            {statusMessage && <div style={{marginBottom:12, color:'#333'}}>{statusMessage}</div>}

            <div style={{display:'flex', gap:12}}>
              <button type="submit" className="btn-primary create-trip" disabled={loadingTrip}>
                {loadingTrip ? 'Creando y generando itinerario...' : 'Armar Viaje'}
              </button>
              <button type="button" className="btn-secondary add-destination" onClick={handleAddDestination}>
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
