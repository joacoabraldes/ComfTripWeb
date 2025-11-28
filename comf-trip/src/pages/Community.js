// src/pages/community.js
import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import '../styles/community.css';
import { apiGet, apiPost, apiDelete } from './api';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { formatDateRange } from '../utils/dateUtils';

export default function Community() {
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [emailOrId, setEmailOrId] = useState('');
  const [sending, setSending] = useState(false);
  const { t } = useTranslation();

  // share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTargetFriend, setShareTargetFriend] = useState(null);
  const [availableTrips, setAvailableTrips] = useState([]);
  const [selectedTripIds, setSelectedTripIds] = useState(new Set());
  const [sharing, setSharing] = useState(false);

  const navigate = useNavigate();

  async function loadAll() {
    setLoading(true);
    try {
      const [fRes, reqRes] = await Promise.all([apiGet('/friends'), apiGet('/friends/requests')]);

      const friendsArr = Array.isArray(fRes) ? fRes : (fRes && fRes.rows ? fRes.rows : []);
      setFriends(friendsArr);

      const incomingArr = (reqRes && reqRes.incoming) ? reqRes.incoming : (Array.isArray(reqRes) ? reqRes : []);
      let outgoingArr = (reqRes && reqRes.outgoing) ? reqRes.outgoing : [];
      // keep only pending outgoing requests
      outgoingArr = (outgoingArr || []).filter(o => (o && o.status ? String(o.status).toLowerCase() === 'pending' : true));

      const cleanedOutgoing = (outgoingArr || []).map(o => {
        if (!o || typeof o !== 'object') return o;
        const { url, share_url, backend_url, ...rest } = o;
        return rest;
      });

      setIncoming(incomingArr || []);
      setOutgoing(cleanedOutgoing || []);
    } catch (err) {
      console.error('Error cargando comunidad:', err);
      const msg = (err && err.message) ? err.message : t('community.loadError');
      alert(`${t('community.loadError')}\n\n${msg}`);
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
    if (!emailOrId) return alert(t('community.enterEmailOrId'));
    setSending(true);
    try {
      const body = {};
      if (emailOrId.includes('@')) body.email = emailOrId;
      else body.addressee_id = Number(emailOrId);

      await apiPost('/friends', body);
      alert(t('community.requestSent'));
      setEmailOrId('');
      await loadAll();
    } catch (err) {
      console.error('Error enviando solicitud:', err);
      const msg = (err && err.message) ? err.message : t('community.requestError');
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
      alert(t('community.acceptError'));
    }
  }

  async function rejectRequest(reqId) {
    try {
      await apiPost(`/friends/${reqId}/reject`);
      await loadAll();
    } catch (err) {
      console.error('Error rechazando:', err);
      alert(t('community.rejectError'));
    }
  }

  async function removeFriend(userId) {
    if (!window.confirm(t('community.removeConfirm'))) return;
    try {
      await apiDelete(`/friends/${userId}`);
      await loadAll();
    } catch (err) {
      console.error('Error eliminando amigo:', err);
      alert(t('community.removeError'));
    }
  }

  // ---------- helpers for share flow ----------
  async function getCurrentUserId() {
    // try known endpoints first
    const candidates = ['/auth/me', '/users/me', '/profile'];
    for (const ep of candidates) {
      try {
        const r = await apiGet(ep);
        if (r && (r.id || r.user_id || r._id)) return r.id || r.user_id || r._id;
      } catch (e) {
        // ignore and try next
      }
    }

    // fallback: try to decode JWT in localStorage.token
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const parts = token.split('.');
        if (parts.length >= 2) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
          if (payload) return payload.id || payload.user_id || payload.sub;
        }
      }
    } catch (e) {
      // ignore
    }
    return null;
  }

  async function openShareModal(friend) {
    setShareTargetFriend(friend);
    setSelectedTripIds(new Set());
    setShowShareModal(true);

    try {
      // fetch trips visible to the user, then filter to only trips owned by the current user
      const trips = await apiGet('/trips');
      const tripsArr = Array.isArray(trips) ? trips : (trips && trips.rows ? trips.rows : []);
      const currentUserId = await getCurrentUserId();

      if (currentUserId == null) {
        // if we can't detect current user, only include trips where no share.owner mismatch
        // but safer to refuse sharing if we can't prove ownership
        setAvailableTrips([]);
        alert(t('community.cannotDetermineUser'));
        return;
      }

      const ownedTrips = tripsArr.filter(t => Number(t?.user_id) === Number(currentUserId));
      if (ownedTrips.length === 0) {
        alert(t('community.noOwnTrips'));
      }
      setAvailableTrips(ownedTrips);
    } catch (err) {
      console.error('Error fetching trips for sharing:', err);
      alert(t('community.noTripsToShare'));
      setAvailableTrips([]);
    }
  }

  function toggleTripSelection(id) {
    setSelectedTripIds(prev => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  }

  async function submitShare() {
    if (!shareTargetFriend) return alert(t('community.share'));
    if (!selectedTripIds.size) return alert(t('community.selectAtLeastOne'));

    setSharing(true);
    const successes = [];
    const failures = [];

    for (const tripId of Array.from(selectedTripIds)) {
      try {
        await apiPost(`/trips/${tripId}/share`, { mode: 'viewer', public: false, shared_with_user_id: shareTargetFriend.id });
        successes.push(tripId);
      } catch (err) {
        console.error(`Share failed for trip ${tripId}:`, err);
        // try to extract meaningful message
        const message = (err && err.message) ? err.message : (err && err.data && err.data.message) ? err.data.message : t('common.error');
        failures.push({ tripId, message });
      }
    }

    setSharing(false);
    let msg = '';
    if (successes.length) msg += t('community.shareSuccess', { count: successes.length }) + '\n';
    if (failures.length) msg += t('community.shareErrors', { count: failures.length }) + '\n' + failures.map(f => ` - ${f.tripId}: ${f.message}`).join('\n');

    alert(msg || t('community.operationCompleted'));
    setShowShareModal(false);
    setShareTargetFriend(null);
    setSelectedTripIds(new Set());
    await loadAll();
  }

  // ---------- UI ----------
  if (loading) {
    return (
      <div>
        <Header />
            <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh"
            }}><div className="muted" style={{fontSize:"25px", alignSelf:"center"}}>{t('community.loading')}</div></div>
      </div>
    );
  }

  return (
    <div>
      <Header />
      <main className="community-main">
        <div className="community-container">
          <h2>{t('community.title')}</h2>

          <section className="card send-request">
            <h3>{t('community.sendRequest')}</h3>
            <div className="send-row">
              <input
                placeholder={t('community.placeholder')}
                value={emailOrId}
                onChange={(e) => setEmailOrId(e.target.value)}
              />
              <button className="btn" onClick={sendRequest} disabled={sending}>{t('community.send')}</button>
            </div>
            <p className="hint">{t('community.hint')}</p>
          </section>

          <section className="card">
            <h3>{t('community.incomingRequests')}</h3>
            {incoming.length === 0 ? <div className="muted">{t('community.noIncoming')}</div> : (
              <div className="list">
                {incoming.map(r => (
                  <div key={r.id} className="list-item">
                    <div className="info">
                      <div className="title">{r.requester_name || r.requester_email || `${t('community.user')} ${r.requester_id}`}</div>
                      <div className="subtitle">{r.requester_email}</div>
                    </div>
                    <div className="actions">
                      <button className="icon-btn" title={t('community.accept')} onClick={() => acceptRequest(r.id)} aria-label={t('community.accept')}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#1abc9c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                      <button className="icon-btn muted" title={t('community.reject')} onClick={() => rejectRequest(r.id)} aria-label={t('community.reject')}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="#e74c3c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h3>{t('community.friends')}</h3>
            {friends.length === 0 ? <div className="muted">{t('community.noFriends')}</div> : (
              <div className="list">
                {friends.map(f => (
                  <div key={f.id} className="list-item">
                    <div className="info">
                      <div className="avatar">{(f.name || f.email || 'U').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()}</div>
                      <div style={{ marginLeft: 12 }}>
                        <div className="title">{f.name}</div>
                        <div className="subtitle">{f.email}</div>
                      </div>
                    </div>
                    <div className="actions">
                      <button className="icon-btn" title={t('community.viewProfile')} onClick={() => navigate(`/friend/${f.id}`)} aria-label={t('community.viewProfile')}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zM2 22a10 10 0 0120 0" stroke="#34495e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>

                      <button className="icon-btn" title={t('community.shareTrips')} onClick={() => openShareModal(f)} aria-label={t('community.shareTrips')}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" stroke="#2b8cff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 3v13M8 7l4-4 4 4" stroke="#2b8cff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>

                      <button className="icon-btn muted" title={t('community.removeFriend')} onClick={() => removeFriend(f.id)} aria-label={t('community.removeFriend')}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6v12a2 2 0 002 2h4a2 2 0 002-2V6M10 6V4a2 2 0 012-2h0a2 2 0 012 2v2" stroke="#e74c3c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h3>{t('community.outgoingRequests')}</h3>
            {outgoing.length === 0 ? <div className="muted">{t('community.noOutgoing')}</div> : (
              <div className="list">
                {outgoing.map(o => (
                  <div key={o.id} className="list-item">
                    <div className="info">
                      <div className="title">{o.addressee_name || o.addressee_email || `${t('community.user')} ${o.addressee_id}`}</div>
                      <div className="subtitle">{o.addressee_email}</div>
                      <div className="tiny">{t('community.status')} {o.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Share modal */}
      {showShareModal && shareTargetFriend && (
        <div className="modal-overlay" onClick={() => { if (!sharing) setShowShareModal(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { if (!sharing) setShowShareModal(false); }}>×</button>
            <h3>{t('community.shareTitle', { name: shareTargetFriend.name || shareTargetFriend.email || `${t('community.user')} ${shareTargetFriend.id}` })}</h3>
            <p className="hint">{t('community.shareSubtitle')}</p>

            <div style={{ marginTop: 14, maxHeight: '50vh', overflow: 'auto' }}>
              {availableTrips.length === 0 ? (
                <div className="muted">{t('community.noOwnTrips')}</div>
              ) : (
                <div className="list">
                  {availableTrips.map(trip => {
                    const isSelected = selectedTripIds.has(trip.id);
                    return (
                      <label key={trip.id} style={{ display: 'block', cursor: 'pointer' }}>
                        <div className="list-item" style={{ alignItems: 'center', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                              <div>
                                <div className="title">{trip.destination || `Viaje #${trip.id}`}</div>
                                <div className="subtitle">{trip.start_date ? formatDateRange(trip.start_date, trip.end_date) : t('trips.unknownDestination')}</div>
                              </div>
                              <div>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => { e.stopPropagation(); toggleTripSelection(trip.id); }}
                                  disabled={sharing}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={() => { if (!sharing) setShowShareModal(false); }} disabled={sharing}>{t('community.cancel')}</button>
              <button className="btn" onClick={submitShare} disabled={sharing || selectedTripIds.size === 0}>
                {sharing ? t('community.sharing') : `${t('community.share')} ${selectedTripIds.size ? `(${selectedTripIds.size})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
