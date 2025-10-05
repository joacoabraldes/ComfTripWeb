// src/pages/community.js
import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import '../styles/community.css';
import { apiGet, apiPost, apiDelete } from './api';
import { useNavigate } from 'react-router-dom';

export default function Community() {
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [emailOrId, setEmailOrId] = useState('');
  const [sending, setSending] = useState(false);
  const navigate = useNavigate();

  // load friends + requests
  async function loadAll() {
    setLoading(true);
    try {
      // your api helpers typically prefix /api internally (same as other pages)
      const [fRes, reqRes] = await Promise.all([
        apiGet('/friends'),
        apiGet('/friends/requests')
      ]);

      const friendsArr = Array.isArray(fRes) ? fRes : (fRes && fRes.rows ? fRes.rows : []);
      setFriends(friendsArr);

      // requests: ensure shape { incoming: [], outgoing: [] }
      const incomingArr = (reqRes && reqRes.incoming) ? reqRes.incoming : (Array.isArray(reqRes) ? reqRes : []);
      const outgoingArr = (reqRes && reqRes.outgoing) ? reqRes.outgoing : [];

      // sanitize outgoing rows to remove any backend-only fields (url, share_url, backend_url...)
      const cleanedOutgoing = (outgoingArr || []).map(o => {
        if (!o || typeof o !== 'object') return o;
        const { url, share_url, backend_url, ...rest } = o;
        return rest;
      });

      setIncoming(incomingArr || []);
      setOutgoing(cleanedOutgoing || []);
    } catch (err) {
      console.error('Error cargando comunidad:', err);
      // show a helpful message (include short error if available)
      const msg = (err && err.message) ? err.message : 'No se pudo cargar la comunidad';
      alert(`No se pudo cargar la comunidad\n\n${msg}`);
      setFriends([]);
      setIncoming([]);
      setOutgoing([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function sendRequest() {
    if (!emailOrId) return alert('Ingresa un email o id de usuario');
    setSending(true);
    try {
      const body = {};
      if (emailOrId.includes('@')) body.email = emailOrId;
      else body.addressee_id = Number(emailOrId);

      await apiPost('/friends', body);
      alert('Solicitud enviada');
      setEmailOrId('');
      await loadAll();
    } catch (err) {
      console.error('Error enviando solicitud:', err);
      const msg = (err && err.message) ? err.message : 'No se pudo enviar la solicitud';
      alert(msg);
    } finally {
      setSending(false);
    }
  }

  async function acceptRequest(reqId) {
    try {
      await apiPost(`/friends/${reqId}/accept`);
      await loadAll();
    } catch (err) {
      console.error('Error aceptando:', err);
      alert('No se pudo aceptar la solicitud');
    }
  }

  async function rejectRequest(reqId) {
    try {
      await apiPost(`/friends/${reqId}/reject`);
      await loadAll();
    } catch (err) {
      console.error('Error rechazando:', err);
      alert('No se pudo rechazar la solicitud');
    }
  }

  async function removeFriend(userId) {
    if (!window.confirm('¿Eliminar amigo?')) return;
    try {
      await apiDelete(`/friends/${userId}`);
      await loadAll();
    } catch (err) {
      console.error('Error eliminando amigo:', err);
      alert('No se pudo eliminar');
    }
  }

  if (loading) {
    return (
      <div>
        <Header />
        <main className="community-main">
          <div className="community-container">
            <h2>Comunidad</h2>
            <div className="muted">Cargando…</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div>
      <Header />
      <main className="community-main">
        <div className="community-container">
          <h2>Comunidad</h2>

          <section className="card send-request">
            <h3>Enviar solicitud</h3>
            <div className="send-row">
              <input
                placeholder="Email o id de usuario"
                value={emailOrId}
                onChange={(e) => setEmailOrId(e.target.value)}
              />
              <button className="btn" onClick={sendRequest} disabled={sending}>Enviar</button>
            </div>
            <p className="hint">Envía por email o por id de usuario.</p>
          </section>

          <section className="card">
            <h3>Solicitudes entrantes</h3>
            {incoming.length === 0 ? <div className="muted">No hay solicitudes entrantes</div> : (
              <div className="list">
                {incoming.map(r => (
                  <div key={r.id} className="list-item">
                    <div className="info">
                      <div className="title">{r.requester_name || r.requester_email || `Usuario ${r.requester_id}`}</div>
                      <div className="subtitle">{r.requester_email}</div>
                    </div>
                    <div className="actions">
                      <button className="btn small" onClick={() => acceptRequest(r.id)}>Aceptar</button>
                      <button className="btn small ghost" onClick={() => rejectRequest(r.id)}>Rechazar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h3>Amigos</h3>
            {friends.length === 0 ? <div className="muted">No tienes amigos aún</div> : (
              <div className="list">
                {friends.map(f => (
                  <div key={f.id} className="list-item">
                    <div className="info">
                      <div className="title">{f.name}</div>
                      <div className="subtitle">{f.email}</div>
                    </div>
                    <div className="actions">
                      <button className="btn small" onClick={() => navigate(`/user/${f.id}`)}>Ver</button>
                      <button className="btn small ghost" onClick={() => removeFriend(f.id)}>Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h3>Solicitudes enviadas</h3>
            {outgoing.length === 0 ? <div className="muted">No hay solicitudes enviadas</div> : (
              <div className="list">
                {outgoing.map(o => (
                  <div key={o.id} className="list-item">
                    <div className="info">
                      <div className="title">{o.addressee_name || o.addressee_email || `Usuario ${o.addressee_id}`}</div>
                      <div className="subtitle">{o.addressee_email}</div>
                      <div className="tiny">Estado: {o.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
