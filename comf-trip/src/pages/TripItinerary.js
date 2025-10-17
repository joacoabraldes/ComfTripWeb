// src/pages/TripItinerary.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Map, { Marker, NavigationControl, Popup } from "react-map-gl/mapbox";
import "../styles/tripItinerary.css";
import Header from "../components/Header";
import "../styles/header.css";
import Select from 'react-select';
import { apiDelete, apiGet, apiPost, apiPut } from "./api";
import flightsApi from '../services/flightsApi';
import { Country, City } from 'country-state-city';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN || "";

export default function TripItinerary() {
  const params = useParams();
  const navigate = useNavigate();
  const tripIdRaw = params.tripId ?? params.id ?? params?.tripId;
  const tripId = Number(tripIdRaw);

  // loading / trip state
  const [loading, setLoading] = useState(true);
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState(null);

  // map state
  const [viewState, setViewState] = useState({
    latitude: -34.6037,
    longitude: -58.3816,
    zoom: 11
  });
  const [selectedLocationOnMap, setSelectedLocationOnMap] = useState(null);

  // flight/backend state (keeps AddTrip-like card)
  const [backendFlight, setBackendFlight] = useState(null);
  const [loadingFlight, setLoadingFlight] = useState(false);
  const [flightMessage, setFlightMessage] = useState(null);

  // AddTrip-like controls
  const [originCountryIso, setOriginCountryIso] = useState(null);
  const [originCityOptions, setOriginCityOptions] = useState([]);
  const [originCityValue, setOriginCityValue] = useState(null);
  const [originAirportOptions, setOriginAirportOptions] = useState([]);
  const [originAirportValue, setOriginAirportValue] = useState(null);
  const [destinationAirportOptions, setDestinationAirportOptions] = useState([]);
  const [destinationAirportValue, setDestinationAirportValue] = useState(null);
  const [flightOffers, setFlightOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(false);
  const [selectedFlightOption, setSelectedFlightOption] = useState(null);

  const COUNTRY_NAME_TO_CODE = {
    'Spain': 'ES',
    'Argentina': 'AR',
    'Italy': 'IT',
    'Germany': 'DE',
    'France': 'FR'
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

  const countryIntlDisplay = useMemo(() => {
    try { return new Intl.DisplayNames(['es'], { type: 'region' }); } catch (e) { return null; }
  }, []);

  const countryOptions = useMemo(() => {
    const all = Country.getAllCountries() || [];
    return all.map(c => {
      const iso = c.isoCode;
      let label;
      try { label = countryIntlDisplay ? countryIntlDisplay.of(iso) : c.name; } catch (e) { label = c.name; }
      return { value: iso, label };
    }).sort((a,b) => a.label.localeCompare(b.label, 'es'));
  }, [countryIntlDisplay]);

  const fmtDate = (d) => {
    if (!d) return "-";
    if (d instanceof Date) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yy = d.getFullYear();
      return `${dd}/${mm}/${yy}`;
    }
    const parts = String(d).split("T")[0].split("-");
    if (parts.length !== 3) return d;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  // trip start ISO for flight searches
  const tripStartIso = useMemo(() => trip?.start_date ? String(trip.start_date).split("T")[0] : null, [trip]);

  // load trip
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!Number.isFinite(tripId) || tripId <= 0) {
        setError("ID de viaje inválido en la URL.");
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const tripRes = await apiGet(`/trips/${tripId}`);
        if (!mounted) return;
        // provide default image if none for first place (non-blocking)
        if (tripRes.places && tripRes.places.length && !(tripRes.places[0].images && tripRes.places[0].images.length)) {
          tripRes.places[0].images = ["https://i.pinimg.com/originals/d8/5d/9a/d85d9a3c01e81a917af38532b6b7523c.jpg"];
        }
        setTrip(tripRes);

        const firstWithCoords = (tripRes.places || []).find((p) => {
          const loc = p.location || {};
          return (loc.latitude !== undefined || loc.latitud !== undefined) && (loc.longitude !== undefined || loc.longitud !== undefined);
        });
        if (firstWithCoords) {
          const loc = firstWithCoords.location || {};
          const lat = Number(loc.latitude ?? loc.latitud);
          const lng = Number(loc.longitude ?? loc.longitud);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            setViewState({ latitude: lat, longitude: lng, zoom: 12 });
          }
        }

        // existing backend flight association (if any)
        const possibleFlightId =
          tripRes.flight_id ||
          tripRes.flight?.flight_id ||
          tripRes.selected_flight?.id ||
          tripRes.selected_flight?.flight_id ||
          null;

        if (possibleFlightId) {
          try {
            const bf = await apiGet(`/flights/${encodeURIComponent(String(possibleFlightId))}`).catch(() => null);
            setBackendFlight(bf || { flight_id: possibleFlightId, created_at: null });
          } catch (e) {
            setBackendFlight({ flight_id: possibleFlightId, created_at: null });
          }
        } else {
          setBackendFlight(null);
        }
      } catch (err) {
        console.error("TripItinerary load error:", err);
        setError("No se pudo cargar el viaje.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [tripId]);

  // origin city autocomplete
  const fetchOriginCityOptions = (input) => {
    const q = typeof input === 'string' ? input.trim() : String(input || '');
    if (!q || q.length < 2) { setOriginCityOptions([]); return; }
    if (!originCountryIso) { setOriginCityOptions([]); return; }
    const found = Country.getAllCountries().find(c => c.isoCode === originCountryIso);
    if (!found) { setOriginCityOptions([]); return; }
    let cities = [];
    try { cities = City.getCitiesOfCountry(found.isoCode) || []; } catch (e){ cities = []; }
    const out = []; const seen = new Set();
    for (let i=0;i<cities.length && out.length<100;i++){
      const c = cities[i];
      if (!c || !c.name) continue;
      if (c.name.toLowerCase().includes(q.toLowerCase())) {
        const key = `${c.name}|||${found.isoCode}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ value: key, label: `${c.name}, ${countryIntlDisplay ? countryIntlDisplay.of(found.isoCode) : found.name}`, meta: { cityName: c.name, countryName: found.name }});
        }
      }
    }
    setOriginCityOptions(out);
  };

  // helper to normalize & filter airports (only IATA)
  const mapAndFilterAirportResults = (items) => {
    if (!Array.isArray(items)) return [];
    return items
      .map(a => {
        const meta = a.meta || a.raw || {};
        const iata = a.value && typeof a.value === 'string' && a.value.length === 3 ? a.value : (meta.iata || meta.iata_code || '');
        const val = iata || a.value || (meta.id || '');
        const label = a.label || (iata ? `${iata} — ${meta.name || ''}` : (meta.name || val));
        return { value: val, label, meta: { ...meta, iata } };
      })
      .filter(x => x.meta && x.meta.iata && String(x.meta.iata).trim().length === 3);
  };

  const fetchOriginAirports = async (cityOrKeyword, limit = 200) => {
    try {
      const res = await flightsApi.getAirportOptionsForSelect(cityOrKeyword || '', limit, originCountryIso || undefined, cityOrKeyword || '');
      setOriginAirportOptions(mapAndFilterAirportResults(res || []));
    } catch (err) {
      console.error('fetchOriginAirports', err);
      setOriginAirportOptions([]);
    }
  };

  const fetchDestinationAirports = async (keywordOrCity, limit = 200) => {
    try {
      const res = await flightsApi.getAirportOptionsForSelect(keywordOrCity || '', limit, undefined, keywordOrCity || '');
      setDestinationAirportOptions(mapAndFilterAirportResults(res || []));
    } catch (err) {
      console.error('fetchDestinationAirports', err);
      setDestinationAirportOptions([]);
    }
  };

  // reset origin dependent fields on country change
  useEffect(() => {
    setOriginCityValue(null);
    setOriginCityOptions([]);
    setOriginAirportValue(null);
    setOriginAirportOptions([]);
  }, [originCountryIso]);

  // when origin city chosen -> load its airports
  useEffect(() => {
    if (!originCityValue) { setOriginAirportOptions([]); return; }
    const cityName = originCityValue.meta?.cityName || originCityValue.label || String(originCityValue.value || '');
    fetchOriginAirports(cityName);
  }, [originCityValue]);

  // when trip loaded, try to populate destination airports by trip destination name
  useEffect(() => {
    if (!trip) return;
    const destCity = trip.destination || '';
    if (destCity) fetchDestinationAirports(destCity);
  }, [trip]);

  // auto-fetch flight offers when originAirport + destinationAirport + tripStartIso available
  useEffect(() => {
    let mounted = true;
    const originCode = originAirportValue?.value || originAirportValue?.meta?.iata || null;
    const destCode = destinationAirportValue?.value || destinationAirportValue?.meta?.iata || null;
    const date = tripStartIso || null;

    if (!originCode || !destCode || !date) {
      setFlightOffers([]);
      setSelectedFlightOption(null);
      setOffersLoading(false);
      return;
    }

    (async () => {
      setOffersLoading(true);
      setFlightOffers([]);
      setSelectedFlightOption(null);
      try {
        const res = await flightsApi.searchFlights({
          originLocationCode: originCode,
          destinationLocationCode: destCode,
          departureDate: date,
          adults: 1,
          max: 12,
          travelClass: 'ECONOMY'
        });

        if (!mounted) return;
        const rawOffers = res?.data || res?.results || res || [];
        const mapped = (rawOffers || []).map((offer, i) => {
          const itinerary = Array.isArray(offer.itineraries) && offer.itineraries[0];
          const segments = (itinerary && Array.isArray(itinerary.segments)) ? itinerary.segments : [];
          const firstSeg = segments[0] || {};
          const lastSeg = segments[segments.length - 1] || firstSeg || {};
          const dep = firstSeg?.departure?.at || firstSeg?.departure?.iataCode || '';
          const arr = lastSeg?.arrival?.at || lastSeg?.arrival?.iataCode || '';
          const times = (dep && arr) ? `${(String(dep).split('T')[1]||dep).slice(0,5)} → ${(String(arr).split('T')[1]||arr).slice(0,5)}` : '';
          const carrier = firstSeg?.carrierCode || firstSeg?.carrier || (offer.flight?.iataNumber ? offer.flight.iataNumber.replace(/\d+/g,'') : '');
          const number = firstSeg?.number || offer.flight?.number || '';
          const flightCode = (carrier||'') + (number ? String(number) : '');
          const airline = offer?.raw?.airline?.name || firstSeg?.carrierName || '';
          const duration = (itinerary && itinerary.duration) ? itinerary.duration : firstSeg?.duration || '';
          return {
            value: offer?.id || offer?.raw?.id || `offer_${i}`,
            label: `${flightCode ? flightCode + ' · ' : ''}${airline || offer.label || ''}`,
            meta: { times, flightCode, airline, duration },
            raw: offer
          };
        });
        setFlightOffers(mapped);
      } catch (err) {
        console.error('auto-fetch flight offers error', err);
        setFlightOffers([]);
      } finally {
        if (mounted) setOffersLoading(false);
      }
    })();

    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originAirportValue, destinationAirportValue, tripStartIso]);

  // persist selected flight (POST /flights, fallback to PUT/associate)
  const handleSaveSelectedFlight = async () => {
    const flightId = selectedFlightOption?.value || selectedFlightOption?.raw?.id;
    if (!flightId) { setFlightMessage('Seleccioná un vuelo primero.'); return; }
    setFlightMessage(null);
    setLoadingFlight(true);
    try {
      await apiPost('/flights', { flight_id: String(flightId), trip_id: tripId });
      setFlightMessage('Vuelo guardado y asociado al viaje.');
      const fresh = await apiGet(`/trips/${tripId}`);
      setTrip(fresh);
      const bf = await apiGet(`/flights/${encodeURIComponent(String(flightId))}`).catch(()=>({ flight_id: flightId }));
      setBackendFlight(bf || { flight_id: flightId });
    } catch (err) {
      const status = err && (err.status || (err.body && err.body.status) || (err.response && err.response.status));
      if (status === 409 || (err && String(err.message || '').includes('409'))) {
        try {
          await apiPut(`/flights/${encodeURIComponent(String(flightId))}`, { trip_id: tripId });
          setFlightMessage('Vuelo existente asociado al viaje.');
          const fresh = await apiGet(`/trips/${tripId}`);
          setTrip(fresh);
          const bf = await apiGet(`/flights/${encodeURIComponent(String(flightId))}`).catch(()=>({ flight_id: flightId }));
          setBackendFlight(bf || { flight_id: flightId });
        } catch (uerr) {
          console.warn('associate put failed', uerr);
          setFlightMessage('No se pudo asociar el vuelo existente.');
        }
      } else {
        console.error('save flight error', err);
        setFlightMessage('Error guardando vuelo. Revisa la consola.');
      }
    } finally {
      setLoadingFlight(false);
    }
  };

  const handleRemoveFlight = async () => {
    const fid = backendFlight?.flight_id || backendFlight?.flightId;
    if (!fid) return;
    if (!window.confirm('Quitar la asociación del vuelo con este viaje?')) return;
    try {
      await apiPut(`/flights/${encodeURIComponent(String(fid))}`, { trip_id: null });
      setFlightMessage('Vuelo desasociado.');
      setBackendFlight(null);
      const fresh = await apiGet(`/trips/${tripId}`);
      setTrip(fresh);
    } catch (err) {
      console.error('disassociate error', err);
      setFlightMessage('Error al desasociar vuelo.');
    }
  };

  // group places by date & helper
  const groupPlacesByDate = (places) => {
    const groups = {};
    (places || []).forEach((p) => {
      const dateKey = p?.date ? String(p.date).split("T")[0] : "no-date";
      groups[dateKey] = groups[dateKey] || [];
      groups[dateKey].push(p);
    });
    const keys = Object.keys(groups).sort((a,b) => {
      if (a === "no-date") return 1;
      if (b === "no-date") return -1;
      return new Date(a) - new Date(b);
    });
    keys.forEach((k) => {
      groups[k].sort((x,y) => {
        const sx = (x.start_hour || "00:00").split(":").map(Number);
        const sy = (y.start_hour || "00:00").split(":").map(Number);
        const mx = (Number.isFinite(sx[0]) ? sx[0] : 0) * 60 + (Number.isFinite(sx[1]) ? sx[1] : 0);
        const my = (Number.isFinite(sy[0]) ? sy[0] : 0) * 60 + (Number.isFinite(sy[1]) ? sy[1] : 0);
        return mx - my;
      });
    });
    return { groups, keys };
  };

  // markers derived from trip.places (defensive filter: only finite coords)
  const markers = (trip?.places || [])
    .map((p) => {
      const loc = p.location || {};
      const latRaw = loc.latitude !== undefined ? loc.latitude : (loc.latitud !== undefined ? loc.latitud : null);
      const lngRaw = loc.longitude !== undefined ? loc.longitude : (loc.longitud !== undefined ? loc.longitud : null);
      const lat = latRaw !== null ? Number(latRaw) : null;
      const lng = lngRaw !== null ? Number(lngRaw) : null;
      return {
        place: p,
        latitude: lat,
        longitude: lng,
        title: loc.titulo ?? p.location?.titulo ?? `Lugar #${p.fk_location}`,
        images: loc.imagenes ?? loc.images ?? p.images ?? []
      };
    })
    .filter(m => Number.isFinite(m.latitude) && Number.isFinite(m.longitude));

  // helper to obtain website for place/location
  const getWebsiteFor = (p) => {
    if (!p) return null;
    const candidates = [p.website, p.link, p.url, p.location?.website, p.location?.url, p.location?.website_url];
    return candidates.find(c => typeof c === "string" && c.trim().length > 0) ?? null;
  };

  // small helper for past check
  const normalizeDate=(d)=>{
    if(!d) return new Date();
    const date=String(d).split("T")[0].split("-");
    const yy = Number(date[0]); const mm =Number(date[1])-1; const dd = Number(date[2]);
    return new Date(yy, mm, dd);
  };
  const pastPlace=(d, et)=>{
    if(!d || !et) return false;
    const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    if(normalizeDate(d).getTime()===today.getTime()){
      const [eh, em] = (et || "00:00").split(":").map(Number);
      const endMinutes = (Number.isFinite(eh) ? eh : 0) * 60 + (Number.isFinite(em) ? em : 0);
      const t=new Date();
      const currentTime=(t.getHours())*60+(t.getMinutes());
      return endMinutes<currentTime;
    }
    return normalizeDate(d)<today;
  };

  if (loading) {
    return (
      <div className="trip-it-root">
        <main className="trip-it-main" style={{
          display: "flex", justifyContent: "center", alignItems: "center", height: "80vh"
        }}>
          <div style={{fontSize:25}}> Cargando itinerario… </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="trip-it-root">
        <Header/>
        <main className="trip-it-main">
          <div style={{ padding: 24 }}>
            <button className="back-link" onClick={() => navigate("/trips")}>← Volver a viajes</button>
            <div style={{ marginTop: 18, color: "#b00020" }}>{error}</div>
          </div>
        </main>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="trip-it-root"><Header/></div>
    );
  }

  // ---------- Flight card (AddTrip-like) ----------
  const flightCard = (
    <section className="card card--white" style={{ marginBottom: 16 }}>
      <h3>Vuelos</h3>

      {backendFlight ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 700 }}>{backendFlight.flight_id}</div>
            <div style={{ color: '#666', marginTop: 6 }}>{backendFlight.created_at ? fmtDate(backendFlight.created_at) : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={async () => {
              const fid = backendFlight.flight_id;
              if (!fid) return;
              setLoadingFlight(true);
              try {
                const bf = await apiGet(`/flights/${encodeURIComponent(String(fid))}`).catch(() => null);
                setBackendFlight(bf || backendFlight);
                setFlightMessage('Refrescado');
              } catch (e) { console.warn(e); }
              setLoadingFlight(false);
            }}>Refrescar</button>
            <button className="btn-secondary" onClick={handleRemoveFlight}>Quitar vuelo</button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flights-grid" style={{ marginTop: 8 }}>
            <div className="field">
              <label>País de origen</label>
              <Select
                options={countryOptions}
                value={countryOptions.find(c => c.value === originCountryIso) || null}
                onChange={(opt) => setOriginCountryIso(opt ? opt.value : null)}
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
                value={originCityValue}
                onChange={(val) => setOriginCityValue(val)}
                onInputChange={(inputValue) => { fetchOriginCityOptions(String(inputValue || '')); return inputValue; }}
                placeholder={originCountryIso ? "Escribe mínimo 2 letras para buscar ciudad" : "Seleccioná país primero"}
                isClearable
                noOptionsMessage={() => 'Escribe para buscar ciudades'}
                isDisabled={!originCountryIso}
              />
            </div>

            <div className="field">
              <label>Aeropuerto de origen</label>
              <Select
                styles={reactSelectStyles}
                options={originAirportOptions}
                value={originAirportValue}
                onChange={(opt) => setOriginAirportValue(opt)}
                placeholder={originAirportOptions.length === 0 ? 'Seleccioná ciudad para cargar aeropuertos' : 'Selecciona aeropuerto de origen'}
                isClearable
                isDisabled={!originCityValue && originAirportOptions.length === 0}
              />
            </div>

            <div className="field">
              <label>Aeropuerto de destino</label>
              <Select
                styles={reactSelectStyles}
                options={destinationAirportOptions}
                value={destinationAirportValue}
                onChange={(opt) => setDestinationAirportValue(opt)}
                placeholder={destinationAirportOptions.length === 0 ? 'Destino no disponible' : 'Selecciona aeropuerto de destino'}
                isClearable
                isDisabled={destinationAirportOptions.length === 0}
              />
            </div>

            <div className="field wide">
              <label>Vuelos disponibles (según día elegido)</label>
              <Select
                styles={reactSelectStyles}
                options={flightOffers}
                value={selectedFlightOption}
                onChange={(opt) => setSelectedFlightOption(opt)}
                placeholder={offersLoading ? 'Buscando vuelos...' : 'Seleccioná un vuelo (si hay)'}
                isClearable
                isDisabled={offersLoading || !(flightOffers?.length > 0)}
                formatOptionLabel={(option) => {
                  const m = option.meta || {};
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div style={{ fontWeight: 700 }}>{m.flightCode ? `${m.flightCode} · ${option.label.replace(/^[^·]+·\s*/,'')}` : option.label}</div>
                      <div style={{ textAlign: 'right', fontSize: 13, color: '#333' }}>
                        {m.times && <div style={{ marginBottom: 2 }}>{m.times}</div>}
                        <div style={{ color: '#666', fontSize: 12 }}>{m.duration || ''}</div>
                      </div>
                    </div>
                  );
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <button className="btn-primary" onClick={handleSaveSelectedFlight} disabled={loadingFlight || !selectedFlightOption}>
              {loadingFlight ? 'Guardando...' : 'Guardar vuelo'}
            </button>
          </div>

          {flightMessage && <div style={{ marginTop: 10, color: '#333' }}>{flightMessage}</div>}
        </div>
      )}
    </section>
  );

  // ---------- Right-hand place detail component (improved look) ----------
  const PlaceDetail = ({ p }) => {
    const loc = p.location || {};
    const image = (loc.imagenes && loc.imagenes[0]) || (loc.images && loc.images[0]) || (p.images && p.images[0]) || null;
    const website = getWebsiteFor(p) || getWebsiteFor(loc);
    return (
      <div className="place-detail" style={{ padding: 16, borderRadius: 10, background: '#fff', boxShadow: '0 6px 20px rgba(0,0,0,0.06)', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          {image ? (
            <img src={image} alt="Lugar" style={{ width: 220, height: 140, objectFit: 'cover', borderRadius: 10 }} />
          ) : (
            <div style={{ width: 220, height: 140, borderRadius: 10, background: '#f3f3f3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
              Sin imagen
            </div>
          )}
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 22 }}>{loc.titulo ?? p.title ?? `Lugar #${p.fk_location}`}</h2>
            <div style={{ color: '#666', marginTop: 6 }}>{fmtDate(p.date)} {p.start_hour ? `· ${String(p.start_hour).slice(0,5)}${p.end_hour ? ` — ${String(p.end_hour).slice(0,5)}` : ''}` : ''}</div>
            {website && (
              <div style={{ marginTop: 10 }}>
                <a href={website.startsWith('http') ? website : `https://${website}`} target="_blank" rel="noreferrer" style={{ color: '#1978c8' }}>
                  Ver sitio
                </a>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 16, flex: 1 }}>
          <h4 style={{ margin: '0 0 8px 0' }}>Notas</h4>
          <div style={{ color: '#333', lineHeight: 1.5 }}>{p.notes || '-'}</div>

          <div style={{ marginTop: 18 }}>
            <h4 style={{ margin: '0 0 8px 0' }}>Ubicación</h4>
            <div style={{ color: '#333' }}>{loc.titulo || loc.address || 'Sin dirección'}</div>
            { (Number.isFinite(Number(loc.latitude)) && Number.isFinite(Number(loc.longitude))) && (
              <div style={{ marginTop: 10 }}>
                <button className="btn-secondary" onClick={() => {
                  // center map on this place
                  setViewState((v) => ({ ...v, latitude: Number(loc.latitude ?? loc.latitud), longitude: Number(loc.longitude ?? loc.longitud), zoom: 16 }));
                }}>Ver en mapa</button>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn-secondary" onClick={() => navigate(`/edit-place/${trip.id}?placeIndex=${(trip.places||[]).findIndex(pp=>pp.id===p.id)}`)}>Editar</button>
          <button className="btn-secondary" onClick={() => { if(window.confirm('¿Eliminar este punto del itinerario?')) apiDelete(`/trips/${tripId}/places/${p.id}`).then(()=> apiGet(`/trips/${tripId}`).then(setTrip)); }}>Eliminar</button>
        </div>
      </div>
    );
  };

  const { groups: groupedPlaces, keys: groupKeys } = groupPlacesByDate(trip.places || []);

  return (
    <div className="trip-it-root">
      <Header/>

      <main className="trip-it-main" style={{ padding: "70px 20px 40px 20px", display: 'grid', gridTemplateColumns: '1fr 600px', gap: 20 }}>
        <section style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <button className="back-link" onClick={() => navigate("/trips")}>← Volver a viajes</button>
              <h2 style={{ marginTop: 8, marginBottom: 4 }}>{trip.destination}</h2>
              <div style={{ color: '#666' }}>{fmtDate(trip.start_date)} — {fmtDate(trip.end_date)}</div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ color: '#888', fontSize: 13 }}>Creado</div>
              <div style={{ fontWeight: 700 }}>{fmtDate(trip.created_at)}</div>
            </div>
          </div>

          {/* Flight card */}
          {flightCard}

          <h3 style={{ marginTop: 18 }}>Itinerario por día</h3>

          <div style={{ marginTop: 8 }}>
            {groupKeys.length === 0 ? (
              <div className="muted">Aún no hay puntos en el itinerario.</div>
            ) : (
              groupKeys.map((dateKey) => (
                <div key={dateKey} style={{ marginBottom: 18 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 16 }}>
                    {dateKey === "no-date" ? "Fecha sin especificar" : fmtDate(dateKey)}
                  </div>
                  <div>
                    {(groupedPlaces[dateKey] || []).map((p, i) => {
                      const loc = p.location || {};
                      const lat = Number(loc.latitude ?? loc.latitud ?? null);
                      const lng = Number(loc.longitude ?? loc.longitud ?? null);
                      const website = getWebsiteFor(p) || getWebsiteFor(loc);
                      const isPast = pastPlace(p.date, p.end_hour);
                      return (
                        <div
                          key={p.id ?? `${dateKey}-${i}`}
                          className="place-item"
                          style={{
                            border: `1px solid ${selectedLocationOnMap && selectedLocationOnMap.place?.id === p.id ? '#ff3951' : '#eee'}`,
                            borderRadius: 8,
                            backgroundColor: isPast ? "#fafafa" : "#fff",
                            marginBottom: 8,
                            padding: 12,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 12,
                            cursor: "pointer"
                          }}
                          onClick={() => {
                            // toggle detail view
                            if (selectedLocationOnMap?.place?.id === p.id) {
                              setSelectedLocationOnMap(null);
                            } else {
                              setSelectedLocationOnMap({ latitude: lat, longitude: lng, place: p, titulo: loc.titulo ?? p.title, image: (loc.imagenes && loc.imagenes[0]) || (loc.images && loc.images[0]) || (p.images && p.images[0]) });
                              if (Number.isFinite(lat) && Number.isFinite(lng)) {
                                setViewState((v) => ({ ...v, latitude: lat, longitude: lng, zoom: 14 }));
                              }
                            }
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                            <div style={{ minWidth: 92 }}>
                              <div style={{ fontSize: 14, color: "#222", fontWeight: 700 }}>
                                { (p.start_hour ? String(p.start_hour).slice(0,5) : "—") } { p.end_hour ? `— ${String(p.end_hour).slice(0,5)}` : "" }
                              </div>
                              <div style={{ fontSize: 12, color: "#666" }}>
                                { (p.location?.titulo) ?? `Lugar #${p.fk_location}` }
                              </div>
                            </div>

                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 15, fontWeight: 600 }}>{p.title ?? p.location?.titulo ?? `Actividad`}</div>
                              {p.notes && <div style={{ fontSize: 13, color: "#444" }}>{p.notes}</div>}
                              {website && (
                                <div style={{ marginTop: 6 }}>
                                  <a href={website.startsWith("http") ? website : `https://${website}`} target="_blank" rel="noreferrer" style={{ color: "#1978c8", fontSize: 13 }}>
                                    Ver sitio
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ position: 'relative' }}>
                              <button
                                className="trip-menu-btn"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  navigate(`/edit-place/${trip.id}?placeIndex=${(trip.places||[]).findIndex(pp => pp.id === p.id)}`);
                                }}
                              >
                                ⋮
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: 10 }}>
            <button onClick={() => navigate(`/add_place/${tripId}`)} className="btn-primary">Agregar al itinerario</button>
          </div>
        </section>

        {/* Right column: either map or selected place detail */}
        <section style={{ height: 'calc(100vh - 140px)' }}>
          {!selectedLocationOnMap ? (
            <div className="map-wrapper" style={{ height: '100%' }}>
              <Map
                {...viewState}
                onMove={(evt) => { if (evt?.viewState) setViewState(evt.viewState); }}
                style={{ width: "100%", height: "100%", borderRadius: "10px" }}
                mapStyle="mapbox://styles/mapbox/streets-v11"
                mapboxAccessToken={MAPBOX_TOKEN}
              >
                <div style={{ position: "absolute", right: 10, top: 10, zIndex: 1 }}>
                  <NavigationControl showCompass showZoom />
                </div>

                {markers.map((m) => (
                  <Marker
                    key={`m-${m.place.id}`}
                    longitude={Number(m.longitude)}
                    latitude={Number(m.latitude)}
                    anchor="bottom">
                    {/* IMPORTANT: stop propagation / immediate propagation so Mapbox's internal handlers don't receive malformed events */}
                    <div
                      onMouseEnter={(e) => {
                        // prevent Mapbox internal mouseover handling which caused the unproject/point[0] error
                        try { if (e?.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') e.nativeEvent.stopImmediatePropagation(); } catch(e){}
                        e.stopPropagation();
                        if (!Number.isFinite(Number(m.latitude)) || !Number.isFinite(Number(m.longitude))) return;
                        setSelectedLocationOnMap({ latitude: m.latitude, longitude: m.longitude, place: m.place, titulo: m.title, image: m.images && m.images.length ? m.images[0] : null });
                      }}
                      onMouseLeave={(e) => { try { if (e?.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') e.nativeEvent.stopImmediatePropagation(); } catch(e){} e.stopPropagation(); setSelectedLocationOnMap(null); }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!Number.isFinite(Number(m.latitude)) || !Number.isFinite(Number(m.longitude))) return;
                        // center map + open detail
                        setViewState((v) => ({ ...v, latitude: Number(m.latitude), longitude: Number(m.longitude), zoom: 16 }));
                        setSelectedLocationOnMap({ latitude: m.latitude, longitude: m.longitude, place: m.place, titulo: m.title, image: m.images && m.images.length ? m.images[0] : null });
                      }}
                      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" style={{ transform: "translate(-12px,-24px)" }} xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ff3951" />
                        <circle cx="12" cy="9" r="2.5" fill="#fff" />
                      </svg>
                    </div>
                  </Marker>
                ))}

                {selectedLocationOnMap && Number.isFinite(Number(selectedLocationOnMap.latitude)) && Number.isFinite(Number(selectedLocationOnMap.longitude)) && (
                  <Popup
                    longitude={Number(selectedLocationOnMap.longitude)}
                    latitude={Number(selectedLocationOnMap.latitude)}
                    anchor="bottom"
                    closeButton={false}
                    offset={[-12, -53]}
                  >
                    <div className="place-popUp">
                      {selectedLocationOnMap.image ? (
                        <img src={selectedLocationOnMap.image} className="img-popUp" alt="Lugar actual" />
                      ) : null}
                      <div className="place-info">
                        <h3>{selectedLocationOnMap.titulo}</h3>
                        {selectedLocationOnMap.place?.date && (<p>{fmtDate(selectedLocationOnMap.place.date)}</p>)}
                        {selectedLocationOnMap.place?.start_hour && (<p>{String(selectedLocationOnMap.place.start_hour).slice(0,5)} - {String(selectedLocationOnMap.place.end_hour).slice(0,5)}</p>)}
                      </div>
                    </div>
                  </Popup>
                )}
              </Map>
            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ color: '#666' }}>{selectedLocationOnMap.place ? fmtDate(selectedLocationOnMap.place.date) : ''}</div>
              </div>
              <div style={{ height: 'calc(100% - 40px)' }}>
                <PlaceDetail p={selectedLocationOnMap.place} />
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
