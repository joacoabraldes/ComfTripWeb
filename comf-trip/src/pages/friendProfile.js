// src/pages/friendProfile.js
import React, {useEffect, useMemo, useState} from 'react';
import { useAuth } from "../auth/AuthProvider";
import {
    addPostComment,
    fetchPostComments,
    fetchSocialFeed,
    togglePostLike
} from '../services/socialService';
import '../styles/friendProfile.css';
import { apiGet } from './api';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from '../i18n';
import {formatDate, formatDateRange, formatDateTime} from '../utils/dateUtils';
import LoadingSpinner from "../components/LoadingSpinner";
import {FaComment, FaHeart, FaRegComment, FaRegHeart, FaTrash, FaUser} from "react-icons/fa";
import FilterSelect from "../components/FilterSelect";
import {displayName, getPostImages, resolveImageUrl} from "./Community";
import {useSnackbar} from "../contexts/SnackbarContext";

export default function FriendProfile() {
    // NOTE: route in App.jsx is "/friend/:friendId"
    const { user } = useAuth();
    const { friendId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [friend, setFriend] = useState(null);
  const [error, setError] = useState(null);
  const { t } = useTranslation();
  const { showError } = useSnackbar();

    const [posts, setPosts] = useState([]);
    const [loadingPosts, setLoadingPosts] = useState(true);

    const [tripsSharedWithMe, setTripsSharedWithMe] = useState([]);
    const [tripsISent, setTripsISent] = useState([]);

    // ---------- LIGHTBOX state ----------
    const [lightbox, setLightbox] = useState({
        open: false,
        images: [],
        index: 0,
    });

    const [loadingPostId, setLoadingPostId] = useState(null);
    const [sendCommentary, setSendCommentary] = useState({});
    const [commentText, setCommentText] = useState({});
    const [commentsByPost, setCommentsByPost] = useState({});
    const [commentsByPostOpen, setCommentsByPostOpen] = useState({});


    async function load() {
        setLoading(true);
        setError(null);
        try {
            // fetch a minimal user profile
            const u= await apiGet(`/friends/${friendId}`);

            //const u = res.user || {};
            // backend may return extra fields; pick only non-sensitive fields
            const safe = {
                id: u?.id,
                name: u?.name || "",
                email: u?.email || "",
                phone: u?.phone || "",
                nationality: u?.nationality || "",
                birthdate: u?.birthdate ? formatDate(u.birthdate): "",
            };
            setFriend(safe);

            // fetch visible trips (trips endpoint returns trips visible to the logged-in user).
            const trips = await apiGet('/trips');
            const tripsArr = Array.isArray(trips) ? trips : (trips && trips.rows ? trips.rows : []);
            // show trips that belong to the friend OR that have share.shared_by === friend.id

            const sharedWithMe = tripsArr.filter(trip => {
                if (!trip?.share) return false;

                return (
                    Number(trip.share.shared_by) === Number(friendId) &&
                    Number(trip.share.shared_with) === Number(user.id)
                );
            });


            // VIAJES QUE YO LE COMPARTÍ
            const iShared = await apiGet(`/share/by-me/${Number(friendId)}`);
            const iSharedArr = Array.isArray(iShared)
                ? iShared
                : (iShared && iShared.rows ? iShared.rows : []);

            setTripsISent(iSharedArr);

            setTripsSharedWithMe(sharedWithMe);

            const posts = await fetchSocialFeed();
            const postsArr= Array.isArray(posts) ? posts : (posts && posts.rows ? posts.rows : []);
            const friendPosts = postsArr.filter(
                post => Number(post.user_id) === Number(friendId)
            );
            setPosts(friendPosts);
        } catch (err) {
            console.error('Error loading friend profile:', err);
            setError(t('friendProfile.loadError'));
            setFriend(null);
            setTripsSharedWithMe([]);
            setTripsISent([]);
        } finally {
            setLoading(false);
            setLoadingPosts(false);

        }
    }

    // ========= FIX IMÁGENES =========
    // Tu API_BASE es .../api  -> para estáticos necesitamos el ORIGIN sin /api
    const BACKEND_ORIGIN = useMemo(() => {
        return (process.env.REACT_APP_API_URL || 'https://comf-trip-backend.vercel.app/api')
            .replace(/\/api\/?$/, '')
            .replace(/\/$/, '');
    }, []);

    function openLightbox(images, index = 0) {
        setLightbox({
            open: true,
            images: images || [],
            index: Number(index) || 0,
        });
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

    // ---------- FEED: cargar comentarios ----------
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

    // ---------- FEED: agregar comentario ----------
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

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [friendId]);

    function TripCard({ trip, navigate, t }) {
        return (
            <div className="trip-card">
                <div className="trip-title">
                    {trip.destination || t('friendProfile.unknownDestination')}
                </div>

                <div className="trip-dates">
                    {trip.start_date
                        ? formatDateRange(trip.start_date, trip.end_date)
                        : t('friendProfile.datesNotSpecified')}
                </div>

                {trip.share && (
                    <div className={`badge ${trip.share.public ? 'badge-primary' : 'badge-secondary'}`}>
                        {trip.share.public
                            ? t('friendProfile.publicLink')
                            : t('friendProfile.shared')}
                        {trip.share.mode ? ` (${trip.share.mode})` : ''}
                    </div>
                )}

                <div style={{ marginTop: 8 }}>
                    <button
                        className="btn small"
                        onClick={() => navigate(`/trip_itinerary/${trip.id}`)}
                    >
                        {t('common.view')}
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <LoadingSpinner message={t('friendProfile.loading')} fullScreen />
        );
    }

    if (error) {
        return (
            <div>
                <main className="friend-main">
                    <div className="friend-container" style={{textAlign:"center", justifyContent:"center", alignItems:"center", paddingTop: 30}}>
                        <div className="error" style={{paddingBottom:10, fontSize:25}}>{error}</div>
                    </div>
                </main>
            </div>
        );
    }

    if (!friend) {
        return (
            <div>
                <main className="friend-main">
                    <div className="friend-container">
                        <div className="muted">{t('friendProfile.notFound')}</div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div>
            <main className="friend-main">
                <div className="friend-container">
                    <div className="profile-card">
                        <div className="profile-main">
                            <div className="profile-left">
                                <div className="profile-photo">
                                    {friend.photo ? <img src={friend.photo} alt={t('profile.photoAlt')} /> : <FaUser className="default-photo" />}
                                </div>
                                <h2 className="profile-name truncate-name" style={{maxWidth:"100%"}}>{friend.name || t('profile.noName')}</h2>
                            </div>

                            <div className="profile-right">
                                <div className="profile-field">
                                    <span className="profile-field-label">{t('profile.email')}</span>
                                    <span className="profile-field-value">{friend.email || "—"}</span>
                                </div>

                                <div className="profile-field">
                                    <span className="profile-field-label">{t('profile.phone')}</span>
                                    <span className="profile-field-value">{friend.phone || "—"}</span>
                                </div>

                                <div className="profile-field">
                                    <span className="profile-field-label">{t('profile.birthdate')}</span>
                                    <span className="profile-field-value">{friend.birthdate || "—"}</span>
                                </div>

                                <div className="profile-field">
                                    <span className="profile-field-label">{t('profile.nationality')}</span>
                                    <span className="profile-field-value">{friend.nationality || "—"}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="friend-card">
                        {/*<div className="friend-header">
              <div className="friend-avatar">{(friend.name || friend.email || 'U').split(' ').map(s=>s[0]).slice(0,2).join('').toUpperCase()}</div>
              <div className="friend-meta">
                <h2>{friend.name}</h2>
                <div className="subtitle">{friend.username ? `@${friend.username}` : friend.email}</div>
                {friend.nationality ? <div className="tiny">{t('profile.nationality')}: {friend.nationality}</div> : null}
                {friend.created_at ? <div className="tiny">{t('friendProfile.memberSince')}: {String(friend.created_at).slice(0,10)}</div> : null}
              </div>
            </div>*/}

                        <div className="friend-body">
                            {/* VIAJES QUE ME COMPARTIÓ */}
                            <h3>{t('friendProfile.sharedWithMe')}</h3>
                            {tripsSharedWithMe.length === 0 ? (
                                <div className="muted">{t('friendProfile.noTrips')}</div>
                            ) : (
                                <div className="friend-trips">
                                    {tripsSharedWithMe.map(trip => (
                                        <TripCard key={trip.id} trip={trip} navigate={navigate} t={t} />
                                    ))}
                                </div>
                            )}
                        </div></div>
                    <div className="friend-card">
                        <div className="friend-body">
                            {/* VIAJES QUE YO LE COMPARTÍ */}
                            <h3>{t('friendProfile.iShared')}</h3>
                            {tripsISent.length === 0 ? (
                                <div className="muted">{t('friendProfile.noTrips')}</div>
                            ) : (
                                <div className="friend-trips">
                                    {tripsISent.map(trip => (
                                        <TripCard key={trip.id} trip={trip} navigate={navigate} t={t} />
                                    ))}
                                </div>
                            )}</div>
                    </div>

                    <div className="friend-card">

                        <h3>{t('friendProfile.posts')}</h3>

                        {loadingPosts && <div className="muted">{t('community.loadingFeed')}</div>}

                        {!loadingPosts && posts.length === 0 && (
                            <div className="muted">{t('friendProfile.noPosts')}</div>
                        )}

                        <div className="feed-posts">
                            {posts.map((post) => {
                                const rawImages = getPostImages(post);
                                const resolvedImages = rawImages.map((url)=>resolveImageUrl(url, BACKEND_ORIGIN));

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

                                            <div style={{ textAlign: 'right' }}>
                                                {post.created_at && (
                                                    <div className="feed-date">{formatDateTime(post.created_at)}</div>
                                                )}
                                            </div>
                                        </header>

                                        {/* ✅ CLICK PARA AMPLIAR */}
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

                                                                {c.created_at && (
                                                                    <div className="feed-date">
                                                                        {new Date(c.created_at).toLocaleString()}
                                                                    </div>
                                                                )}
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
                    </div>

                </div>
            </main>
        </div>
    );
}
