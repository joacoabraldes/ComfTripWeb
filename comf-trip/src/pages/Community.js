// src/pages/community.js
import React, { useEffect, useState } from 'react';
import '../styles/community.css';
import { FaCheck, FaTimes, FaUser, FaShare, FaTrash } from 'react-icons/fa';
import { apiGet, apiPost, apiDelete } from './api';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { formatDateRange } from '../utils/dateUtils';
import ShareTripModal from '../components/ShareTripModal';
import IconButton from '../components/IconButton';
import ActionButton from '../components/ActionButton';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';

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
  
  // confirm dialog state
  const [removeConfirm, setRemoveConfirm] = useState({ isOpen: false, userId: null });

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

  function handleRemoveFriendClick(userId) {
    setRemoveConfirm({ isOpen: true, userId });
  }

  async function removeFriend(userId) {
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

  function handleShareSuccess() {
    loadAll();
  }

  // ---------- UI ----------
  if (loading) {
    return <LoadingSpinner message={t('community.loading')} fullScreen />;
  }

  return (
    <div>
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
              <ActionButton variant="primary" onClick={sendRequest} disabled={sending}>
                {t('community.send')}
              </ActionButton>
            </div>
            <p className="hint">{t('community.hint')}</p>
          </section>

          <section className="card">
            <h3>{t('community.incomingRequests')}</h3>
            {incoming.length === 0 ? (
              <EmptyState message={t('community.noIncoming')} />
            ) : (
              <div className="list">
                {incoming.map(r => (
                  <div key={r.id} className="list-item">
                    <div className="info">
                      <div className="avatar">{(r.requester_name || r.requester_email || 'U').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()}</div>
                      <div style={{ marginLeft: 12 }}>
                          <div className="title">{r.requester_name}</div>
                          <div className="subtitle">{r.requester_email}</div>
                      </div>
                    </div>
                    <div className="actions">
                      <IconButton
                        icon={<FaCheck size={16} color="#1abc9c" />}
                        onClick={() => acceptRequest(r.id)}
                        title={t('community.accept')}
                        ariaLabel={t('community.accept')}
                      />
                      <IconButton
                        icon={<FaTimes size={16} color="#e74c3c" />}
                        onClick={() => rejectRequest(r.id)}
                        title={t('community.reject')}
                        ariaLabel={t('community.reject')}
                        variant="muted"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h3>{t('community.friends')}</h3>
            {friends.length === 0 ? (
              <EmptyState message={t('community.noFriends')} />
            ) : (
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
                      <IconButton
                        icon={<FaUser size={16} color="#34495e" />}
                        onClick={() => navigate(`/friend/${f.id}`)}
                        title={t('community.viewProfile')}
                        ariaLabel={t('community.viewProfile')}
                      />

                      <IconButton
                        icon={<FaShare size={16} color="#2b8cff" />}
                        onClick={() => openShareModal(f)}
                        title={t('community.shareTrips')}
                        ariaLabel={t('community.shareTrips')}
                      />

                      <IconButton
                        icon={<FaTrash size={16} color="#e74c3c" />}
                        onClick={() => handleRemoveFriendClick(f.id)}
                        title={t('community.removeFriend')}
                        ariaLabel={t('community.removeFriend')}
                        variant="muted"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h3>{t('community.outgoingRequests')}</h3>
            {outgoing.length === 0 ? (
              <EmptyState message={t('community.noOutgoing')} />
            ) : (
              <div className="list">
                {outgoing.map(o => (
                  <div key={o.id} className="list-item">
                    <div className="info">
                        <div className="avatar">{(o.addressee_name || o.addressee_email || 'U').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()}</div>
                        <div style={{ marginLeft: 12 }}>
                            <div className="title">{o.addressee_name}</div>
                            <div className="subtitle">{o.addressee_email}</div>
                            {/*<div className="tiny">{t('community.status')} {o.status}</div>*/}
                        </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Share modal */}
      <ShareTripModal
        isOpen={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          setShareTargetFriend(null);
        }}
        friend={shareTargetFriend}
        availableTrips={availableTrips}
        onShareSuccess={handleShareSuccess}
      />

      {/* Confirmación de eliminación */}
      <ConfirmDialog
        isOpen={removeConfirm.isOpen}
        onClose={() => setRemoveConfirm({ isOpen: false, userId: null })}
        onConfirm={() => {
          if (removeConfirm.userId) {
            removeFriend(removeConfirm.userId);
          }
        }}
        title={t('community.removeTitle')}
        message={t('community.removeConfirm')}
        confirmText={t('community.remove')}
        variant="primary"
      />
    </div>
  );
}
