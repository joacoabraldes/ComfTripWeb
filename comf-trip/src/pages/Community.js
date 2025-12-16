// src/pages/Community.js
import React, { useEffect, useState, useMemo } from 'react';
import '../styles/community.css';
import { useAuth } from "../auth/AuthProvider";
import {
  FaCheck,
  FaTimes,
  FaUser,
  FaShare,
  FaTrash,
  FaImage,
  FaHeart,
  FaRegHeart,
  FaComment,
  FaRegComment,
} from 'react-icons/fa';
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
  deleteSocialPost,
  deletePostComment,
} from '../services/socialService';
import { formatDateTime } from '../utils/dateUtils';
import { useSnackbar } from "../contexts/SnackbarContext";

/* =========================
   LIGHTBOX (inline)
   ========================= */
function ImageLightbox({ open, images, index, onClose, onPrev, onNext }) {
  if (!open) return null;

  const hasMany = (images?.length || 0) > 1;
  const current = images?.[index] || '';

  return (
    <div className="img-lightbox-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="img-lightbox" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="img-lightbox-close"
          onClick={onClose}
          aria-label="Close"
          title="Close"
        >
          ×
        </button>

        {hasMany && (
          <>
            <button
              type="button"
              className="img-lightbox-nav left"
              onClick={onPrev}
              aria-label="Previous"
              title="Previous"
            >
              ‹
            </button>
            <button
              type="button"
              className="img-lightbox-nav right"
              onClick={onNext}
              aria-label="Next"
              title="Next"
            >
              ›
            </button>
          </>
        )}

        <img className="img-lightbox-img" src={current} alt={`image-${index}`} />

        {hasMany && (
          <div className="img-lightbox-counter">
            {index + 1} / {images.length}
          </div>
        )}
      </div>
    </div>
  );
}

export function resolveImageUrl(url, BACKEND_ORIGIN) {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('data:') || /^(https?:)?\/\//.test(url)) {
    return url;
  }
  if (url.startsWith('/uploads/')) {
    return `${BACKEND_ORIGIN}${url}`;
  }
  return url;
}

export function getPostImages(post) {
  if (!post || post.images == null) return [];
  if (Array.isArray(post.images)) return post.images;
  if (typeof post.images === 'string') {
    try {
      const parsed = JSON.parse(post.images);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function displayName(author_name, author_username, t) {
  if (author_name) return author_name;
  if (author_username) return `@${author_username}`;
  return t('community.user');
}

function userTitle(u) {
  return u?.name || (u?.username ? `@${u.username}` : (u?.email || ''));
}
function userSubtitle(u) {
  if (!u) return '';
  const hasName = !!u.name;
  const uname = u.username ? `@${u.username}` : '';
  const mail = u.email || '';
  if (hasName) {
    if (uname && mail) return `${uname} • ${mail}`;
    if (mail) return mail;
    return uname;
  }
  // no name
  if (uname && mail) return mail; // ya mostramos @username arriba
  return mail;
}

export default function Community() {
  const { t } = useTranslation();
  const { showError, showSuccess } = useSnackbar();
  const navigate = useNavigate();
  const { user } = useAuth();

  // ---------- comunidad / amigos ----------
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);

  // ✅ ahora es email o username
  const [emailOrId, setEmailOrId] = useState('');
  const [sending, setSending] = useState(false);

  const [searchFriends, setSearchFriends] = useState('');
  const [searchIncoming, setSearchIncoming] = useState('');
  const [searchOutgoing, setSearchOutgoing] = useState('');

  // ---------- social feed ----------
  const [posts, setPosts] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [feedError, setFeedError] = useState(null);
  const [newPost, setNewPost] = useState('');
  const [commentText, setCommentText] = useState({});
  const [loadingPostId, setLoadingPostId] = useState(null);
  const [commentsByPost, setCommentsByPost] = useState({});
  const [commentsByPostOpen, setCommentsByPostOpen] = useState({});
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [loadingCommentId, setLoadingCommentId] = useState(null);
  const [sendCommentary, setSendCommentary] = useState({});

  // share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTargetFriend, setShareTargetFriend] = useState(null);
  const [availableTrips, setAvailableTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(true);

  const [isRemoveFriend, setIsRemoveFriend] = useState(false);
  const [isRemovePost, setIsRemovePost] = useState(false);
  const [isRemoveComment, setIsRemoveComment] = useState(false);

  const [removeConfirm, setRemoveConfirm] = useState({
    isOpen: false,
    userId: null,
  });

  // ---------- LIGHTBOX state ----------
  const [lightbox, setLightbox] = useState({
    open: false,
    images: [],
    index: 0,
  });

  function openLightbox(images, index = 0) {
    setLightbox({
      open: true,
      images: images || [],
      index: Number(index) || 0,
    });
  }
  function closeLightbox() {
    setLightbox({ open: false, images: [], index: 0 });
  }
  function nextLightbox() {
    setLightbox((prev) => {
      const n = prev.images.length;
      if (!n) return prev;
      return { ...prev, index: (prev.index + 1) % n };
    });
  }
  function prevLightbox() {
    setLightbox((prev) => {
      const n = prev.images.length;
      if (!n) return prev;
      return { ...prev, index: (prev.index - 1 + n) % n };
    });
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (!lightbox.open) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextLightbox();
      if (e.key === 'ArrowLeft') prevLightbox();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightbox.open]);

  const BACKEND_ORIGIN = useMemo(() => {
    return (process.env.REACT_APP_API_URL || 'https://comf-trip-backend.vercel.app/api')
      .replace(/\/api\/?$/, '')
      .replace(/\/$/, '');
  }, []);

  function filterUsers(list, search, fields = []) {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((item) =>
      fields.some((field) => {
        const value = item[field];
        if (!value) return false;
        let text = value.toString().toLowerCase();
        if (text.includes('@')) text = text.split('@')[0];
        return text.includes(q);
      })
    );
  }

  // ✅ incluir username en filtros
  const filteredFriends = filterUsers(friends, searchFriends, ['name', 'username', 'email']);
  const filteredIncoming = filterUsers(incoming, searchIncoming, ['requester_name', 'requester_username', 'requester_email']);
  const filteredOutgoing = filterUsers(outgoing, searchOutgoing, ['addressee_name', 'addressee_username', 'addressee_email']);

  useEffect(() => {
    loadAll();
    loadFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [fRes, reqRes] = await Promise.all([apiGet('/friends'), apiGet('/friends/requests')]);

      const friendsArr = Array.isArray(fRes) ? fRes : fRes && fRes.rows ? fRes.rows : [];
      setFriends(friendsArr);

      const incomingArr = reqRes && reqRes.incoming ? reqRes.incoming : Array.isArray(reqRes) ? reqRes : [];
      let outgoingArr = reqRes && reqRes.outgoing ? reqRes.outgoing : [];

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
      showError(`${t('community.loadError')}\n\n${msg}`);
      setFriends([]);
      setIncoming([]);
      setOutgoing([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadFeed() {
    try {
      setLoadingFeed(true);
      setFeedError(null);
      const data = await fetchSocialFeed();
      setPosts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setFeedError(err?.message || t('community.errorFeed'));
      setPosts([]);
    } finally {
      setLoadingFeed(false);
    }
  }

  async function handleCreatePost(e) {
    e.preventDefault();
    if (!newPost.trim() && attachedFiles.length === 0) return;

    try {
      setLoadingPostId('new');
      const res = await createSocialPost({
        content: newPost.trim(),
        files: attachedFiles,
      });

      const created = res.post || res;
      setPosts((prev) => [created, ...prev]);
      setNewPost('');
      setAttachedFiles([]);
    } catch (err) {
      console.error(err);
      showError(t('community.errorCreatePost'));
    } finally {
      setLoadingPostId(null);
    }
  }

  async function handleDeletePost(postId) {
    if (!postId) return;

    try {
      setLoadingPostId(postId);
      await deleteSocialPost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      console.error(err);
      showError(t('community.errorDeletePost'));
    } finally {
      setLoadingPostId(null);
    }
  }

  async function handleDeleteComment(commentId) {
    if (!commentId) return;

    try {
      setLoadingCommentId(commentId);
      await deletePostComment(commentId);
      setCommentsByPost((prev) => ({
        ...prev,
        [loadingPostId]: prev[loadingPostId]?.filter((c) => c.id !== commentId) || [],
      }));
    } catch (err) {
      console.error(err);
      showError(t('community.errorDeleteComment'));
    } finally {
      setLoadingPostId(null);
      setLoadingCommentId(null);
    }
  }

  function handleRemoveFile(indexToRemove) {
    setAttachedFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  }

  function handleFilesChange(e) {
    const files = Array.from(e.target.files || []);
    setAttachedFiles(files);
  }

  async function handleToggleLike(postId) {
    try {
      setLoadingPostId(postId);
      const res = await togglePostLike(postId);
      const liked = !!res?.liked;

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
      showError(t('community.errorLike'));
    } finally {
      setLoadingPostId(null);
    }
  }

  async function handleLoadComments(postId) {
    if (commentsByPostOpen[postId]) {
      setCommentsByPostOpen((prev) => ({ ...prev, [postId]: false }));
      return;
    }

    if (commentsByPost[postId]) {
      setCommentsByPostOpen((prev) => ({ ...prev, [postId]: true }));
      return;
    }

    try {
      const comments = await fetchPostComments(postId);
      setCommentsByPost((prev) => ({ ...prev, [postId]: comments }));
      setCommentsByPostOpen((prev) => ({ ...prev, [postId]: true }));
    } catch (err) {
      console.error(err);
      showError(t('community.errorLoadingCom'));
    }
  }

  async function handleAddComment(e, postId) {
    e.preventDefault();
    const text = (commentText[postId] || '').trim();
    if (!text) return;

    try {
      setSendCommentary((prev) => ({ ...prev, [postId]: true }));
      await addPostComment(postId, text);

      const comments = await fetchPostComments(postId);
      setCommentsByPost((prev) => ({ ...prev, [postId]: comments }));
      setCommentText((prev) => ({ ...prev, [postId]: '' }));
    } catch (err) {
      console.error(err);
      showError(t('community.errorAddingCon'));
    } finally {
      setSendCommentary((prev) => ({ ...prev, [postId]: false }));
    }
  }

  // ---------- acciones comunidad ----------
  async function sendRequest() {
    if (!emailOrId.trim()) return showError(t('community.enterEmailOrId'));

    const input = emailOrId.trim();
    setSending(true);
    try {
      const body = {};
      if (input.includes('@')) body.email = input;
      else body.username = input; // ✅ username en vez de id

      await apiPost('/friends', body);
      showSuccess(t('community.requestSent'));
      setEmailOrId('');
      await loadAll();
    } catch (err) {
      console.error('Error enviando solicitud:', err);
      const msg = (err && err.message) || t('community.requestError');
      showError(msg);
    } finally {
      setSending(false);
    }
  }

  async function acceptRequest(reqId) {
    try {
      await apiPost(`/friends/${reqId}/accept`);
      showSuccess(t('community.acceptSuccess'));
      await loadAll();
      await loadFeed();
    } catch (err) {
      console.error('Error aceptando:', err);
      showError(t('community.acceptError'));
    }
  }

  async function rejectRequest(reqId) {
    try {
      await apiPost(`/friends/${reqId}/reject`);
      showSuccess(t('community.rejectSuccess'));
      await loadAll();
    } catch (err) {
      console.error('Error rechazando:', err);
      showError(t('community.rejectError'));
    }
  }

  function handleRemoveFriendClick(userId) {
    setRemoveConfirm({ isOpen: true, userId });
  }

  async function removeFriend(userId) {
    try {
      await apiDelete(`/friends/${userId}`);
      showSuccess(t('community.removeSuccess'));
      await loadAll();
      await loadFeed();
    } catch (err) {
      console.error('Error eliminando amigo:', err);
      showError(t('community.removeError'));
    }
  }

  async function openShareModal(friend) {
    setLoadingTrips(true);
    setShareTargetFriend(friend);
    setShowShareModal(true);

    try {
      const trips = await apiGet('/trips');
      const tripsArr = Array.isArray(trips) ? trips : trips && trips.rows ? trips.rows : [];
      const currentUserId2 = user.id;

      if (currentUserId2 == null) {
        setAvailableTrips([]);
        showError(t('community.cannotDetermineUser'));
        return;
      }

      const ownedTrips = tripsArr.filter((tt) => Number(tt?.user_id) === Number(currentUserId2));
      if (ownedTrips.length === 0) showError(t('community.noOwnTrips'));
      setAvailableTrips(ownedTrips);
    } catch (err) {
      console.error('Error fetching trips for sharing:', err);
      showError(t('community.noTripsToShare'));
      setAvailableTrips([]);
    } finally {
      setLoadingTrips(false);
    }
  }

  function handleShareSuccess() {
    // opcional
  }

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
                    placeholder={t('community.placeholder') /* si tu i18n dice email/id no pasa nada */}
                    value={emailOrId}
                    onChange={(e) => setEmailOrId(e.target.value)}
                  />
                  <ActionButton variant="primary" onClick={sendRequest} disabled={sending}>
                    {sending ? t('community.sending') : t('community.send')}
                  </ActionButton>
                </div>
                <p className="hint">
                  {t('community.hint') /* ideal: “Email o username” */}
                </p>
              </section>

              <section className="card list-users">
                <h3>{t('community.friends')} {friends.length === 0 ? "" : `(${friends.length})`}</h3>
                {friends.length === 0 ? (
                  <EmptyState message={t('community.noFriends')} />
                ) : (
                  <div className="list">
                    <input
                      className="list-search"
                      type="text"
                      placeholder={t('community.searchUser')}
                      value={searchFriends}
                      onChange={(e) => setSearchFriends(e.target.value)}
                    />

                    {filteredFriends.length === 0 ? (
                      <EmptyState message={t('community.noSearchFriends')} />
                    ) : (
                      <div>
                        {filteredFriends.map((f) => (
                          <div key={f.id} className="list-item">
                            <div className="info">
                              <div className="avatar">
                                {(f.name || f.username || f.email || 'U')
                                  .toString()
                                  .split(' ')
                                  .map((s) => s[0])
                                  .slice(0, 2)
                                  .join('')
                                  .toUpperCase()}
                              </div>
                              <div style={{ marginLeft: 12 }}>
                                <div className="title truncate">{userTitle(f)}</div>
                                {!!userSubtitle(f) && <div className="subtitle truncate">{userSubtitle(f)}</div>}
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
                                onClick={() => {
                                  handleRemoveFriendClick(f.id);
                                  setIsRemoveFriend(true);
                                }}
                                title={t('community.removeFriend')}
                                ariaLabel={t('community.removeFriend')}
                                variant="muted"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className="card list-users">
                <h3>{t('community.incomingRequests')} {incoming.length === 0 ? "" : `(${incoming.length})`}</h3>

                {incoming.length === 0 ? (
                  <EmptyState message={t('community.noIncoming')} />
                ) : (
                  <div className="list">
                    <input
                      className="list-search"
                      type="text"
                      placeholder={t('community.searchUser')}
                      value={searchIncoming}
                      onChange={(e) => setSearchIncoming(e.target.value)}
                    />

                    {filteredIncoming.length === 0 ? (
                      <EmptyState message={t('community.noSearchIncoming')} />
                    ) : (
                      <div>
                        {filteredIncoming.map((r) => {
                          const item = {
                            name: r.requester_name,
                            username: r.requester_username,
                            email: r.requester_email,
                          };
                          return (
                            <div key={r.id} className="list-item">
                              <div className="info">
                                <div className="avatar">
                                  {(r.requester_name || r.requester_username || r.requester_email || 'U')
                                    .toString()
                                    .split(' ')
                                    .map((s) => s[0])
                                    .slice(0, 2)
                                    .join('')
                                    .toUpperCase()}
                                </div>
                                <div style={{ marginLeft: 12 }}>
                                  <div className="title truncate">{userTitle(item)}</div>
                                  {!!userSubtitle(item) && <div className="subtitle truncate">{userSubtitle(item)}</div>}
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
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section className="card list-users">
                <h3>{t('community.outgoingRequests')} {outgoing.length === 0 ? "" : `(${outgoing.length})`}</h3>

                {outgoing.length === 0 ? (
                  <EmptyState message={t('community.noOutgoing')} />
                ) : (
                  <div className="list">
                    <input
                      className="list-search"
                      type="text"
                      placeholder={t('community.searchUser')}
                      value={searchOutgoing}
                      onChange={(e) => setSearchOutgoing(e.target.value)}
                    />

                    {filteredOutgoing.length === 0 ? (
                      <EmptyState message={t('community.noSearchOutgoing')} />
                    ) : (
                      <div>
                        {filteredOutgoing.map((o) => {
                          const item = {
                            name: o.addressee_name,
                            username: o.addressee_username,
                            email: o.addressee_email,
                          };
                          return (
                            <div key={o.id} className="list-item">
                              <div className="info">
                                <div className="avatar">
                                  {(o.addressee_name || o.addressee_username || o.addressee_email || 'U')
                                    .toString()
                                    .split(' ')
                                    .map((s) => s[0])
                                    .slice(0, 2)
                                    .join('')
                                    .toUpperCase()}
                                </div>
                                <div style={{ marginLeft: 12 }}>
                                  <div className="title truncate">{userTitle(item)}</div>
                                  {!!userSubtitle(item) && <div className="subtitle truncate">{userSubtitle(item)}</div>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>
            </aside>

            {/* ---- FEED CENTRAL ---- */}
            <section className="community-feed">
              <section className="card feed-card">
                <h3>{t('community.titleFeed')}</h3>
                <form onSubmit={handleCreatePost} className="feed-new-post">
                  <textarea
                    className="feed-textarea"
                    rows={3}
                    placeholder={t('community.inputPost')}
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                  />

                  <div className="feed-attachments">
                    <label className="btn ghost small file-upload-btn">
                      <FaImage size={14} style={{ marginRight: 6 }} />
                      {attachedFiles.length > 0 ? t('community.changePhoto') : t('community.addPhoto')}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        capture="environment"
                        onChange={handleFilesChange}
                      />
                    </label>

                    {attachedFiles.length > 0 && (
                      <div className="feed-preview-row">
                        {attachedFiles.map((file, index) => (
                          <div key={file.name + file.lastModified} className="feed-preview-thumb">
                            <img src={URL.createObjectURL(file)} alt={file.name} />
                            <button
                              type="button"
                              className="feed-preview-remove"
                              onClick={() => handleRemoveFile(index)}
                              aria-label={t('community.removePhoto')}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="feed-new-post-footer">
                    <span className="feed-hint">{t('community.hintPost')}</span>
                    <button type="submit" disabled={loadingPostId === 'new'} className="btn">
                      {loadingPostId === 'new' ? t('community.publishing') : t('community.publish')}
                    </button>
                  </div>
                </form>
              </section>

              <section className="card feed-card">
                {loadingFeed && <div className="spinner">{t('community.loadingFeed')}</div>}
                {feedError && <div className="error-text">{feedError}</div>}
                {!loadingFeed && posts.length === 0 && !feedError && (
                  <div className="muted">{t('community.noPost')}</div>
                )}

                <div className="feed-posts">
                  {posts.map((post) => {
                    const rawImages = getPostImages(post);
                    const resolvedImages = rawImages.map((url) => resolveImageUrl(url, BACKEND_ORIGIN));

                    return (
                      <article
                        key={post.id}
                        className="feed-post"
                        style={{
                          borderColor:
                            Number(post.user_id) === Number(user.id)
                              ? 'var(--color-accent)'
                              : '',
                        }}
                      >
                        <header className="feed-post-header">
                          <div style={{ display: 'flex' }}>
                            <div className="avatar">
                              {(post.author_name || post.author_username || 'U')
                                .toString()
                                .split(' ')
                                .map((s) => s[0])
                                .slice(0, 2)
                                .join('')
                                .toUpperCase()}
                            </div>

                            <div className="feed-author" style={{ paddingLeft: 10 }}>
                              <div className="feed-author-name">
                                {displayName(post.author_name, post.author_username, t)}
                              </div>

                              {post.author_username && post.author_name && (
                                <div className="feed-author-username">@{post.author_username}</div>
                              )}
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            {post.created_at && (
                              <div className="feed-date">{formatDateTime(post.created_at)}</div>
                            )}

                            {Number(post.user_id) === Number(user.id) && (
                              <button
                                className="btn icon danger small"
                                style={{ marginTop: 5 }}
                                onClick={() => {
                                  handleRemoveFriendClick(post.id);
                                  setIsRemovePost(true);
                                }}
                                disabled={loadingPostId === post.id}
                                title={t('community.deletePost')}
                                type="button"
                              >
                                <FaTrash size={12} />
                              </button>
                            )}
                          </div>
                        </header>

                        {resolvedImages.length > 0 && (
                          <div className="feed-images">
                            {resolvedImages.map((url, idx) => (
                              <button
                                key={idx}
                                type="button"
                                className="feed-image-wrapper feed-image-btn"
                                onClick={() => openLightbox(resolvedImages, idx)}
                                aria-label={t('community.openImage') || 'Open image'}
                                title={t('community.openImage') || 'Open image'}
                              >
                                <img src={url} alt={`post-${post.id}-${idx}`} />
                              </button>
                            ))}
                          </div>
                        )}

                        {post.content && (
                          <div
                            className="feed-post-content"
                            style={{
                              display: 'flex',
                              gap: 5,
                              paddingLeft: 5,
                              paddingTop: 5,
                              paddingBottom: 5,
                            }}
                          >
                            <div className="feed-author-name">
                              {displayName(post.author_name, post.author_username, t)}
                            </div>
                            <div className="feed-comment" style={{ paddingTop: 0 }}>
                              {post.content}
                            </div>
                          </div>
                        )}

                        <div className="feed-post-actions">
                          <button
                            type="button"
                            disabled={loadingPostId === post.id}
                            onClick={() => handleToggleLike(post.id)}
                            className="btn like small"
                          >
                            {post.liked_by_me ? (
                              <FaHeart size={20} color="var(--color-primary)" />
                            ) : (
                              <FaRegHeart size={20} color="var(--color-text-primary)" />
                            )}{' '}
                            {post.like_count || 0} Likes
                          </button>

                          <button
                            type="button"
                            onClick={() => handleLoadComments(post.id)}
                            className="btn comments small"
                          >
                            {commentsByPostOpen[post.id] ? (
                              <FaComment size={20} color={'var(--color-success)'} />
                            ) : (
                              <FaRegComment size={20} color="var(--color-text-primary)" />
                            )}{' '}
                            {commentsByPost[post.id] ? commentsByPost[post.id].length : post.comment_count} {t('community.comment')}
                          </button>
                        </div>

                        {commentsByPost[post.id] && commentsByPostOpen[post.id] && (
                          <div className="feed-comments">
                            <div className="feed-comments-list">
                              {commentsByPost[post.id].length === 0 && (
                                <p className="muted">{t('community.noCommentaries')}</p>
                              )}
                              {commentsByPost[post.id].map((c) => (
                                <div key={c.id} className="feed-comment-item">
                                  <div className="feed-comment-header">
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                      <div className="avatar">
                                        {(c.author_name || c.author_username || 'U')
                                          .toString()
                                          .split(' ')
                                          .map((s) => s[0])
                                          .slice(0, 2)
                                          .join('')
                                          .toUpperCase()}
                                      </div>

                                      <div className="feed-author">
                                        <div className="feed-author-name">
                                          {displayName(c.author_name, c.author_username, t)}
                                        </div>

                                        {c.author_username && c.author_name && (
                                          <div className="feed-author-username">@{c.author_username}</div>
                                        )}
                                      </div>
                                    </div>

                                    <div style={{ textAlign: 'right' }}>
                                      {c.created_at && (
                                        <div className="feed-date">
                                          {new Date(c.created_at).toLocaleString()}
                                        </div>
                                      )}
                                      {Number(c.user_id) === Number(user.id) && (
                                        <button
                                          className="btn icon danger small"
                                          style={{ marginTop: 5 }}
                                          onClick={() => {
                                            handleRemoveFriendClick(c.id);
                                            setLoadingPostId(post.id);
                                            setIsRemoveComment(true);
                                          }}
                                          disabled={loadingCommentId === c.id}
                                          title={t('community.deletePost')}
                                          type="button"
                                        >
                                          <FaTrash size={12} />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="feed-comment">{c.content}</div>
                                </div>
                              ))}
                            </div>

                            <form onSubmit={(e) => handleAddComment(e, post.id)} className="feed-comment-form">
                              <textarea
                                className="feed-comment-input"
                                rows={1}
                                value={commentText[post.id] || ''}
                                onChange={(e) => {
                                  setCommentText((prev) => ({
                                    ...prev,
                                    [post.id]: e.target.value,
                                  }));
                                }}
                              />

                              <button
                                type="submit"
                                className="btn small"
                                style={{ height: '35px' }}
                                disabled={sendCommentary[post.id]}
                              >
                                {!sendCommentary[post.id] ? t('community.send') : t('community.sending')}
                              </button>
                            </form>
                          </div>
                        )}
                      </article>
                    );
                  })}
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
        onClose={() => {
          setRemoveConfirm({ isOpen: false, userId: null });
          setIsRemoveFriend(false);
          setIsRemovePost(false);
          setIsRemoveComment(false);
        }}
        onConfirm={() => {
          if (!removeConfirm.userId) return;

          if (isRemoveFriend) removeFriend(removeConfirm.userId);
          else if (isRemovePost) handleDeletePost(removeConfirm.userId);
          else if (isRemoveComment) handleDeleteComment(removeConfirm.userId);
        }}
        title={
          isRemoveFriend
            ? t('community.removeTitle')
            : (isRemovePost
              ? t('community.removePostTitle')
              : (isRemoveComment ? t('community.removeCommentTitle') : ""))
        }
        message={
          isRemoveFriend
            ? t('community.removeConfirm')
            : (isRemovePost
              ? t('community.removePostConfirm')
              : (isRemoveComment ? t('community.removeCommentConfirm') : ""))
        }
        confirmText={t('community.remove')}
        variant="primary"
      />

      {/* Lightbox */}
      <ImageLightbox
        open={lightbox.open}
        images={lightbox.images}
        index={lightbox.index}
        onClose={closeLightbox}
        onPrev={prevLightbox}
        onNext={nextLightbox}
      />
    </div>
  );
}
