// src/pages/friendProfile.js
import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import '../styles/friendProfile.css';
import { apiGet } from './api';
import { useParams, useNavigate } from 'react-router-dom';

export default function FriendProfile() {
  // NOTE: route in App.jsx is "/friend/:friendId"
  const { friendId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [friend, setFriend] = useState(null);
  const [visibleTrips, setVisibleTrips] = useState([]);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // fetch a minimal user profile
      const u = await apiGet(`/users/${friendId}`);
      // backend may return extra fields; pick only non-sensitive fields
      const safe = {
        id: u?.id,
        name: u?.name,
        email: u?.email,
        username: u?.username || null,
        nationality: u?.nationality || null,
        created_at: u?.created_at || null,
      };
      setFriend(safe);

      // fetch visible trips (trips endpoint returns trips visible to the logged-in user).
      const trips = await apiGet('/trips');
      const tripsArr = Array.isArray(trips) ? trips : (trips && trips.rows ? trips.rows : []);
      // show trips that belong to the friend OR that have share.shared_by === friend.id
      const friendTrips = tripsArr.filter(t => {
        if (!t) return false;
        if (Number(t.user_id) === Number(friendId)) return true;
        if (t.share && Number(t.share.shared_by) === Number(friendId)) return true;
        return false;
      });
      setVisibleTrips(friendTrips);
    } catch (err) {
      console.error('Error loading friend profile:', err);
      setError('No se pudo cargar el perfil del usuario.');
      setFriend(null);
      setVisibleTrips([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friendId]);

  if (loading) {
    return (
      <div>
        <Header />
        <main className="friend-main">
          <div className="friend-container">
            <div className="muted">Cargando perfil…</div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Header />
        <main className="friend-main">
          <div className="friend-container">
            <div className="error">{error}</div>
            <button className="btn small" onClick={() => navigate(-1)}>Volver</button>
          </div>
        </main>
      </div>
    );
  }

  if (!friend) {
    return (
      <div>
        <Header />
        <main className="friend-main">
          <div className="friend-container">
            <div className="muted">Usuario no encontrado</div>
            <button className="btn small" onClick={() => navigate(-1)}>Volver</button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div>
      <Header />
      <main className="friend-main">
        <div className="friend-container">
          <div className="friend-card">
            <div className="friend-header">
              <div className="friend-avatar">{(friend.name || friend.email || 'U').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()}</div>
              <div className="friend-meta">
                <h2>{friend.name}</h2>
                <div className="subtitle">{friend.username ? `@${friend.username}` : friend.email}</div>
                {friend.nationality ? <div className="tiny">Nacionalidad: {friend.nationality}</div> : null}
                {friend.created_at ? <div className="tiny">Miembro desde: {String(friend.created_at).slice(0,10)}</div> : null}
              </div>
            </div>

            <div className="friend-body">
              <h3>Viajes visibles</h3>
              {visibleTrips.length === 0 ? (
                <div className="muted">No hay viajes visibles de este usuario.</div>
              ) : (
                <div className="friend-trips">
                  {visibleTrips.map(t => (
                    <div key={t.id} className="trip-card">
                      <div className="trip-title">{t.destination || 'Destino desconocido'}</div>
                      <div className="trip-dates">{t.start_date ? `${t.start_date?.slice(0,10)} — ${t.end_date?.slice(0,10)}` : 'Fechas no especificadas'}</div>
                      {t.share ? (
                        <div className={`badge ${t.share.public ? 'badge-primary' : 'badge-secondary'}`}>
                          {t.share.public ? 'Enlace público' : 'Compartido'}{t.share.mode ? ` (${t.share.mode})` : ''}
                        </div>
                      ) : null}
                      <div style={{ marginTop: 8 }}>
                        <button className="btn small" onClick={() => navigate(`/trip_itinerary/${t.id}`)}>Ver viaje</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginTop: 18 }}>
              <button className="btn ghost small" onClick={() => navigate(-1)}>Volver</button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
