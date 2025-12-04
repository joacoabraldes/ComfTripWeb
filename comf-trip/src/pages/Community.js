// src/pages/Community.js
import React, { useEffect, useState } from 'react';
import '../styles/community.css';
import { FaCheck, FaTimes, FaUser, FaShare, FaTrash } from 'react-icons/fa';
import { apiGet, apiPost, apiDelete } from './api';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import ShareTripModal from '../components/ShareTripModal';
import IconButton from '../components/IconButton';
import ActionButton from '../components/ActionButton';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';

import {
  fetchSocialFeed,
  createSocialPost,
  togglePostLike,
  fetchPostComments,
  addPostComment,
} from '../services/socialService';

export default function Community() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // ---------- comunidad / amigos ----------
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [emailOrId, setEmailOrId] = useState('');
  const [sending, setSending] = useState(false);

  // share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTargetFriend, setShareTargetFriend] = useState(null);
  const [availableTrips, setAvailableTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(true);

  // confirm dialog state
  const [removeConfirm, setRemoveConfirm] = useState({
    isOpen: false,
    userId: null,
  });

  // ---------- social feed ----------
  const [posts, setPosts] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [feedError, setFeedError] = useState(null);
  const [newPost, setNewPost] = useState('');
  const [commentText, setCommentText] = useState({});
  const [loadingPostId, setLoadingPostId] = useState(null);
  const [commentsByPost, setCommentsByPost] = useState({});

  // ---------- carga inicial ----------
  useEffect(() => {
    loadAll();
    loadFeed();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [fRes, reqRes] = await Promise.all([
        apiGet('/friends'),
        apiGet('/friends/requests'),
      ]);

      const friendsArr = Array.isArray(fRes)
        ? fRes
        : fRes && fRes.rows
        ? fRes.rows
        : [];
      setFriends(friendsArr);

      const incomingArr =
        reqRes && reqRes.incoming
          ? reqRes.incoming
          : Array.isArray(reqRes)
          ? reqRes
          : [];
      let outgoingArr = reqRes && reqRes.outgoing ? reqRes.outgoing : [];

      // solo pendientes
      outgoingArr = (outgoingArr || []).filter((o) =>
        o && o.status ? String(o.status).toLowerCase() === 'pending' : true
      );

      const cleanedOutgoing = (outgoingArr || []).map((o) => {
        if (!o || typeof o !== 'object') return o;
        const { url, share_url, backend_url, ...rest } = o;
        return rest;
      });

      setIncoming(incomingArr || []);
      setOutgoing(cleanedOutgoing || []);
    } catch (err) {
      console.error('Error cargando comunidad:', err);
      const msg = err && err.message ? err.message : t('community.loadError');
      alert(`${t('community.loadError')}\n\n${msg}`);
      setFriends([]);
      setIncoming([]);
      setOutgoing([]);
    } finally {
      setLoading(false);
    }
  }

  // ---------- FEED: cargar ----------
  async function loadFeed() {
    try {
      setLoadingFeed(true);
      setFeedError(null);
      const data = await fetchSocialFeed();
      setPosts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setFeedError(err.message || 'Error cargando el feed');
      setPosts([]);
    } finally {
      setLoadingFeed(false);
    }
  }

  // ---------- FEED: crear post ----------
  async function handleCreatePost(e) {
    e.preventDefault();
    if (!newPost.trim()) return;

    try {
      setLoadingPostId('new');
      const res = await createSocialPost({ content: newPost.trim() });

      const created =
        res.post || {
          id: res.id,
          content: res.content,
          user_id: res.user_id,
          created_at: res.created_at,
          like_count: 0,
          comment_count: 0,
          liked_by_me: false,
          author_username: res.author_username || null,
          author_name: res.author_name || null,
        };

      setPosts((prev) => [created, ...prev]);
      setNewPost('');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error al crear el post');
    } finally {
      setLoadingPostId(null);
    }
  }

  // ---------- FEED: like / unlike ----------
  async function handleToggleLike(postId) {
    try {
      setLoadingPostId(postId);
      const res = await togglePostLike(postId);
      const { liked } = res;

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                liked_by_me: liked,
                like_count: (p.like_count || 0) + (liked ? 1 : -1),
              }
            : p
        )
      );
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error cambiando like');
    } finally {
      setLoadingPostId(null);
    }
  }

  // ---------- FEED: cargar comentarios ----------
  async function handleLoadComments(postId) {
    if (commentsByPost[postId]) return; // ya cargados

    try {
      const comments = await fetchPostComments(postId);
      setCommentsByPost((prev) => ({ ...prev, [postId]: comments }));
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error cargando comentarios');
    }
  }

  // ---------- FEED: agregar comentario ----------
  async function handleAddComment(e, postId) {
    e.preventDefault();
    const text = (commentText[postId] || '').trim();
    if (!text) return;

    try {
      const res = await addPostComment(postId, text);
      const newComment = res.comment || res;

      const existing = commentsByPost[postId] || [];
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: [...existing, newComment],
      }));

      setCommentText((prev) => ({ ...prev, [postId]: '' }));
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error agregando comentario');
    }
  }

  // ---------- acciones comunidad ----------
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
      const msg = (err && err.message) || t('community.requestError');
      alert(msg);
    } finally {
      setSending(false);
    }
  }

  async function acceptRequest(reqId) {
    try {
      await apiPost(`/friends/${reqId}/accept`);
      await loadAll();
      await loadFeed(); // por si el nuevo amigo ya tenía posts
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
      await loadFeed();
    } catch (err) {
      console.error('Error eliminando amigo:', err);
      alert(t('community.removeError'));
    }
  }

  // ---------- helpers share ----------
  async function getCurrentUserId() {
    const candidates = ['/auth/me', '/users/me', '/profile'];
    for (const ep of candidates) {
      try {
        const r = await apiGet(ep);
        if (r && (r.id || r.user_id || r._id))
          return r.id || r.user_id || r._id;
      } catch (e) {}
    }

    try {
      const token = localStorage.getItem('token');
      if (token) {
        const parts = token.split('.');
        if (parts.length >= 2) {
          const payload = JSON.parse(
            atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
          );
          if (payload) return payload.id || payload.user_id || payload.sub;
        }
      }
    } catch (e) {}
    return null;
  }

  async function openShareModal(friend) {
    setLoadingTrips(true);
    setShareTargetFriend(friend);
    setShowShareModal(true);

    try {
      const trips = await apiGet('/trips');
      const tripsArr = Array.isArray(trips)
        ? trips
        : trips && trips.rows
        ? trips.rows
        : [];
      const currentUserId = await getCurrentUserId();

      if (currentUserId == null) {
        setAvailableTrips([]);
        alert(t('community.cannotDetermineUser'));
        return;
      }

      const ownedTrips = tripsArr.filter(
        (t) => Number(t?.user_id) === Number(currentUserId)
      );
      if (ownedTrips.length === 0) {
        alert(t('community.noOwnTrips'));
      }
      setAvailableTrips(ownedTrips);
    } catch (err) {
      console.error('Error fetching trips for sharing:', err);
      alert(t('community.noTripsToShare'));
      setAvailableTrips([]);
    } finally {
      setLoadingTrips(false);
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
          <h2 className="community-title">{t('community.title')}</h2>

          <div className="community-layout">
            {/* ---- SIDEBAR: amigos + solicitudes ---- */}
            <aside className="community-sidebar">
              <section className="card send-request">
                <h3>{t('community.sendRequest')}</h3>
                <div className="send-row">
                  <input
                    placeholder={t('community.placeholder')}
                    value={emailOrId}
                    onChange={(e) => setEmailOrId(e.target.value)}
                  />
                  <ActionButton
                    variant="primary"
                    onClick={sendRequest}
                    disabled={sending}
                  >
                    {t('community.send')}
                  </ActionButton>
                </div>
                <p className="hint">{t('community.hint')}</p>
              </section>

              <section className="card">
                <h3>{t('community.friends')}</h3>
                {friends.length === 0 ? (
                  <EmptyState message={t('community.noFriends')} />
                ) : (
                  <div className="list">
                    {friends.map((f) => (
                      <div key={f.id} className="list-item">
                        <div className="info">
                          <div className="avatar">
                            {(f.name || f.email || 'U')
                              .split(' ')
                              .map((s) => s[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </div>
                          <div style={{ marginLeft: 12 }}>
                            <div className="title">{f.name || f.email}</div>
                            {f.name && <div className="subtitle">{f.email}</div>}
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
                <h3>{t('community.incomingRequests')}</h3>
                {incoming.length === 0 ? (
                  <EmptyState message={t('community.noIncoming')} />
                ) : (
                  <div className="list">
                    {incoming.map((r) => (
                      <div key={r.id} className="list-item">
                        <div className="info">
                          <div className="avatar">
                            {(r.requester_name || r.requester_email || 'U')
                              .split(' ')
                              .map((s) => s[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </div>
                          <div style={{ marginLeft: 12 }}>
                            <div className="title">
                              {r.requester_name || r.requester_email}
                            </div>
                            {r.requester_name && (
                              <div className="subtitle">{r.requester_email}</div>
                            )}
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
                <h3>{t('community.outgoingRequests')}</h3>
                {outgoing.length === 0 ? (
                  <EmptyState message={t('community.noOutgoing')} />
                ) : (
                  <div className="list">
                    {outgoing.map((o) => (
                      <div key={o.id} className="list-item">
                        <div className="info">
                          <div className="avatar">
                            {(o.addressee_name || o.addressee_email || 'U')
                              .split(' ')
                              .map((s) => s[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </div>
                          <div style={{ marginLeft: 12 }}>
                            <div className="title">
                              {o.addressee_name || o.addressee_email}
                            </div>
                            {o.addressee_name && (
                              <div className="subtitle">{o.addressee_email}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </aside>

            {/* ---- FEED CENTRAL ---- */}
            <section className="community-feed">
              <section className="card feed-card">
                <h3>Social feed</h3>
                <form onSubmit={handleCreatePost} className="feed-new-post">
                  <textarea
                    className="feed-textarea"
                    rows={3}
                    placeholder="¿Qué querés compartir con tus amigos sobre tus viajes?"
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                  />
                  <div className="feed-new-post-footer">
                    <span className="feed-hint">
                      Tus amigos verán tus publicaciones en orden cronológico.
                    </span>
                    <button
                      type="submit"
                      disabled={loadingPostId === 'new'}
                      className="btn"
                    >
                      {loadingPostId === 'new' ? 'Publicando...' : 'Publicar'}
                    </button>
                  </div>
                </form>
              </section>

              <section className="card feed-card">
                {loadingFeed && <div className="spinner">Cargando feed...</div>}

                {feedError && <div className="error-text">{feedError}</div>}

                {!loadingFeed && posts.length === 0 && !feedError && (
                  <div className="muted">
                    No hay publicaciones todavía. Empezá creando tu primer post.
                  </div>
                )}

                <div className="feed-posts">
                  {posts.map((post) => (
                    <article key={post.id} className="feed-post">
                      <header className="feed-post-header">
                        <div className="avatar">
                          {(post.author_username ||
                            post.author_name ||
                            'U')
                            .toString()
                            .split(' ')
                            .map((s) => s[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </div>
                        <div className="feed-author">
                          {/* username como principal */}
                          <div className="feed-author-name">
                            {post.author_username
                              ? `@${post.author_username}`
                              : post.author_name || 'Usuario'}
                          </div>
                          {/* debajo, si existe name y username, mostramos el nombre “humano” */}
                          {post.author_username && post.author_name && (
                            <div className="feed-author-username">
                              {post.author_name}
                            </div>
                          )}
                          {post.created_at && (
                            <div className="feed-meta">
                              {new Date(post.created_at).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </header>

                      <div className="feed-post-content">{post.content}</div>

                      <div className="feed-post-actions">
                        <button
                          type="button"
                          disabled={loadingPostId === post.id}
                          onClick={() => handleToggleLike(post.id)}
                          className={`btn small ${
                            post.liked_by_me ? 'btn-like-active' : 'btn-like'
                          }`}
                        >
                          {post.liked_by_me ? '💙' : '🤍'} {post.like_count || 0} likes
                        </button>

                        <button
                          type="button"
                          onClick={() => handleLoadComments(post.id)}
                          className="btn ghost small"
                        >
                          Ver comentarios
                          {post.comment_count > 0 ? ` (${post.comment_count})` : ''}
                        </button>
                      </div>

                      {commentsByPost[post.id] && (
                        <div className="feed-comments">
                          {commentsByPost[post.id].length === 0 && (
                            <p className="muted">No hay comentarios todavía.</p>
                          )}
                          {commentsByPost[post.id].map((c) => (
                            <div key={c.id} className="feed-comment-item">
                              <strong>{c.author_name || 'Usuario'}</strong>: {c.content}
                            </div>
                          ))}

                          <form
                            onSubmit={(e) => handleAddComment(e, post.id)}
                            className="feed-comment-form"
                          >
                            <input
                              type="text"
                              className="feed-comment-input"
                              placeholder="Escribir un comentario..."
                              value={commentText[post.id] || ''}
                              onChange={(e) =>
                                setCommentText((prev) => ({
                                  ...prev,
                                  [post.id]: e.target.value,
                                }))
                              }
                            />
                            <button type="submit" className="btn small">
                              Enviar
                            </button>
                          </form>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            </section>
          </div>
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
        chooseTrips={true}
        loadingTrips={loadingTrips}
      />

      {/* Confirmación de eliminación */}
      <ConfirmDialog
        isOpen={removeConfirm.isOpen}
        onClose={() =>
          setRemoveConfirm({
            isOpen: false,
            userId: null,
          })
        }
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
