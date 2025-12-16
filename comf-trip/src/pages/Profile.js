// src/pages/Profile.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet} from "./api";
import "../styles/profile.css";
import {FaUser, FaEdit, FaLock, FaSignOutAlt, FaTrash} from "react-icons/fa";
import "../styles/header.css";
import {useAuth} from "../auth/AuthProvider";
import { useTranslation } from "../i18n";
import LoadingSpinner from "../components/LoadingSpinner";
import FilterSelect from "../components/FilterSelect";
import {formatDate, formatDateTime} from "../utils/dateUtils";
import ConfirmDialog from "../components/ConfirmDialog";

import {
    fetchSocialFeed,
    togglePostLike,
    fetchPostComments,
    addPostComment, deletePostComment, deleteSocialPost,
} from "../services/socialService";

import {
    displayName,
    getPostImages,
    ImageLightbox,
    resolveImageUrl,
} from "./Community";

import {
    FaHeart,
    FaRegHeart,
    FaComment,
    FaRegComment,
} from "react-icons/fa";
import {useSnackbar} from "../contexts/SnackbarContext";


export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, token, logout, setUser, hydrated } = useAuth();
  const [loading, setLoading] = useState(true);
  const { t, language, setLanguage } = useTranslation();
    const { showError} = useSnackbar();


    const [profile, setProfile] = useState({
    id: null,
    name: "",
    email: "",
    phone: "",
    nationality: "",
    birthdate: "",
    photo: ""
  });
  const [logoutConfirm, setLogoutConfirm] = useState(false);

    const [posts, setPosts] = useState([]);
    const [loadingPosts, setLoadingPosts] = useState(true);

    const [loadingPostId, setLoadingPostId] = useState(null);
    const [commentsByPost, setCommentsByPost] = useState({});
    const [commentsByPostOpen, setCommentsByPostOpen] = useState({});
    const [commentText, setCommentText] = useState({});
    const [sendCommentary, setSendCommentary] = useState({});

    const [loadingCommentId, setLoadingCommentId] = useState(null);

    const [lightbox, setLightbox] = useState({
        open: false,
        images: [],
        index: 0,
    });

    const [isRemovePost, setIsRemovePost]=useState(false);
    const [isRemoveComment, setIsRemoveComment]=useState(false);

    // confirm dialog state
    const [removeConfirm, setRemoveConfirm] = useState({
        isOpen: false,
        userId: null,
    });



    useEffect(() => {
    if(!hydrated) return;
    if (!token || !user) {
      navigate("/login");
      return;
    }

    const id = user.id;
    if (!id) {
      navigate("/login");
      return;
    }

    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await apiGet(`/users/${id}`);
        const u = res.user || {};
          await loadMyPosts();
          if (!mounted) return;

        setProfile({
          id: u.id,
          name: u.name || "",
          email: u.email || "",
          phone: u.phone || "",
          nationality: u.nationality || "",
          birthdate: u.birthdate ? formatDate(u.birthdate) : "",
          photo: u.photo || ""
        });
      } catch (err) {
        console.error("Error fetching profile:", err);
        if (err && (err.message === "No token" || err.message === "Token inválido" || err.status === 401 || err.status === 403)) {
          navigate("/login");
        } else {
          // optional: show error UI
        }
      } finally {
        if (mounted) setLoading(false);

      }
    })();
  }, [user, token, hydrated, navigate, setUser]);

  function handleLogout() {
    setLogoutConfirm(true);
  }

  function confirmLogout() {
    logout();
    navigate("/login");
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

    const BACKEND_ORIGIN = React.useMemo(() => {
        return (process.env.REACT_APP_API_URL || 'https://comf-trip-backend.vercel.app/api')
            .replace(/\/api\/?$/, '')
            .replace(/\/$/, '');
    }, []);


    async function loadMyPosts() {
        try {
            setLoadingPosts(true);
            const feed = await fetchSocialFeed();
            const arr = Array.isArray(feed) ? feed : (feed?.rows || []);

            const myPosts = arr.filter(
                (post) => Number(post.user_id) === Number(user.id)
            );

            setPosts(myPosts);
        } catch (err) {
            console.error("Error loading my posts", err);
        } finally {
            setLoadingPosts(false);
        }
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
        } finally {
            setLoadingPostId(null);
        }
    }

    async function handleLoadComments(postId) {
        if (commentsByPostOpen[postId]) {
            setCommentsByPostOpen((p) => ({ ...p, [postId]: false }));
            return;
        }

        if (commentsByPost[postId]) {
            setCommentsByPostOpen((p) => ({ ...p, [postId]: true }));
            return;
        }

        const comments = await fetchPostComments(postId);
        setCommentsByPost((p) => ({ ...p, [postId]: comments }));
        setCommentsByPostOpen((p) => ({ ...p, [postId]: true }));
    }

    async function handleAddComment(e, postId) {
        e.preventDefault();
        const text = (commentText[postId] || "").trim();
        if (!text) return;

        setSendCommentary((p) => ({ ...p, [postId]: true }));
        await addPostComment(postId, text);

        const comments = await fetchPostComments(postId);
        setCommentsByPost((p) => ({ ...p, [postId]: comments }));
        setCommentText((p) => ({ ...p, [postId]: "" }));
        setSendCommentary((p) => ({ ...p, [postId]: false }));
    }

    if (loading) {
        return <LoadingSpinner message={t('profile.loading')} fullScreen />
    }


    return (
    <div className="profile-root" >

      <div className="profile-container" >
        <div className="profile-card">
          <div className="profile-main">
            <div className="profile-left">
              <div className="profile-photo">
                {profile.photo ? <img src={profile.photo} alt={t('profile.photoAlt')} /> : <FaUser className="default-photo" />}
              </div>
              <h2 className="profile-name truncate-name" style={{maxWidth:"100%"}}>{profile.name || t('profile.noName')}</h2>
            </div>

            <div className="profile-right">
              <div className="profile-field">
                <span className="profile-field-label">{t('profile.email')}</span>
                <span className="profile-field-value">{profile.email || "—"}</span>
              </div>

              <div className="profile-field">
                <span className="profile-field-label">{t('profile.phone')}</span>
                <span className="profile-field-value">{profile.phone || "—"}</span>
              </div>

              <div className="profile-field">
                <span className="profile-field-label">{t('profile.birthdate')}</span>
                <span className="profile-field-value">{profile.birthdate || "—"}</span>
              </div>

              <div className="profile-field">
                <span className="profile-field-label">{t('profile.nationality')}</span>
                <span className="profile-field-value">{profile.nationality || "—"}</span>
              </div>

              <div className="profile-field">
                <span className="profile-field-label">{t('profile.language')}</span>
                <FilterSelect
                  value={language}
                  onChange={setLanguage}
                  options={[
                      { value: 'es', label: t('profile.spanish') },
                      { value: 'en', label: t('profile.english') },
                  ]}
                  isClearable={false}
                />
                <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>{t('profile.languageDescription')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="profile-actions">
          {/* Row with Edit Profile and Change Password */}
          <div className="text-button-row">
            <button onClick={() => navigate("/edit-profile")} className="btn-text">
              <FaEdit /> {t('profile.editProfile')}
            </button>
            <button onClick={() => navigate("/change-password")} className="btn-text">
              <FaLock /> {t('profile.changePassword')}
            </button>
          </div>

          {/* Logout Button */}
          <button onClick={handleLogout} className="btn-primary">
            <FaSignOutAlt /> {t('profile.logout')}
          </button>
        </div>
          <div className="card feed-card" style={{marginBottom:30, marginTop:30}}>
              <h3>{t('friendProfile.posts')}</h3>

              {loadingPosts && <div className="muted">{t("community.loadingFeed")}</div>}

              {!loadingPosts && posts.length === 0 && (
                  <div className="muted">{t("friendProfile.noPosts")}</div>
              )}

              <div className="feed-posts" >
                  {posts.map((post) => {
                      const rawImages = getPostImages(post);
                      const images = rawImages.map((url) =>
                          resolveImageUrl(url, BACKEND_ORIGIN)
                      );

                      return (
                          <article key={post.id} className="feed-post">
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

                                          <button
                                              className="btn icon danger small"
                                              style={{ marginTop: 5 }}
                                              onClick={() =>{
                                                  setRemoveConfirm({ isOpen: true, userId: post.id });
                                                  setIsRemovePost(true)
                                              }}
                                              disabled={loadingPostId === post.id}
                                              title={t('community.deletePost')}
                                              type="button"
                                          >
                                              <FaTrash size={12} />
                                          </button>

                                  </div>
                              </header>
                              <header className="feed-post-header">

                                  <div style={{ textAlign: 'right' }}>
                                      {post.created_at && (
                                          <div className="feed-date">{formatDateTime(post.created_at)}</div>
                                      )}
                                  </div>
                              </header>
                              {images.length > 0 && (
                                  <div className="feed-images">
                                      {images.map((url, idx) => (
                                          <button
                                              key={idx}
                                              className="feed-image-wrapper feed-image-btn"
                                              onClick={() =>
                                                  setLightbox({ open: true, images, index: idx })
                                              }
                                          >
                                              <img src={url} alt="" />
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
                                              <div key={c.id} className="feed-comment-item" style={{
                                                  borderColor:
                                                      Number(c.user_id) === Number(user.id)
                                                          ? 'var(--color-accent)'
                                                          : '',
                                              }}>
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
                                                                  onClick={() =>{
                                                                      setRemoveConfirm({ isOpen: true, userId: c.id });
                                                                      setLoadingPostId(post.id)
                                                                      setIsRemoveComment(true)
                                                                  }}
                                                                  disabled={loadingCommentId === c.id}
                                                                  title={t('community.deletePost')}
                                                                  type="button"
                                                              >
                                                                  <FaTrash size={12} />
                                                              </button>
                                                          )}</div>
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

      {/* Confirmación de cierre de sesión */}
      <ConfirmDialog
        isOpen={logoutConfirm}
        onClose={() => setLogoutConfirm(false)}
        onConfirm={confirmLogout}
        title={t('profile.logoutTitle')}
        message={t('profile.logoutConfirm')}
        confirmText={t('profile.logout')}
        variant="primary"
      />

        <ConfirmDialog
            isOpen={removeConfirm.isOpen}
            onClose={() =>
            {setRemoveConfirm({
                isOpen: false,
                userId: null,
            })
                setIsRemovePost(false)
                setIsRemoveComment(false)
            }
            }
            onConfirm={() => {
                if (removeConfirm.userId) {
                    if(isRemovePost) {
                        handleDeletePost(removeConfirm.userId)
                    }
                    else if(isRemoveComment) {
                        handleDeleteComment(removeConfirm.userId)
                    }
                }
            }}
            title={ isRemovePost ? t('community.removePostTitle') : (isRemoveComment ? t('community.removeCommentTitle') : "") }
            message={ isRemovePost ? t('community.removePostConfirm') : (isRemoveComment ? t('community.removeCommentConfirm') : "") }
            confirmText={t('community.remove') }
            variant="primary"
        />

        <ImageLightbox
            open={lightbox.open}
            images={lightbox.images}
            index={lightbox.index}
            onClose={() => setLightbox({ open: false, images: [], index: 0 })}
        />

    </div>
  );
}


//version2 con posibles cambios
// src/pages/Profile.js
/* import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "./api";
import "../styles/profile.css";
import { useAuth } from "../auth/AuthProvider";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, token, logout, hydrated } = useAuth();
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState({
    id: null,
    name: "",
    photo: "",
    description: ""
  });

  useEffect(() => {
    if (!hydrated) return;
    if (!token || !user) {
      navigate("/login");
      return;
    }

    const id = user.id;
    if (!id) {
      navigate("/login");
      return;
    }

    let mounted = true;

    (async () => {
      setLoading(true);
      try {
        const res = await apiGet(`/users/${id}`);
        const u = res.user || {};
        if (!mounted) return;

        setProfile({
          id: u.id,
          name: u.name || "",
          photo: u.photo || "",
          description: u.description || ""
        });
      } catch (err) {
        console.error("Error fetching profile:", err);
        if (err && (err.message === "No token" || err.message === "Token inválido" || err.status === 401 || err.status === 403)) {
          navigate("/login");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user, token, hydrated, navigate]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  if (loading) {
    return <div className="profile-root loading">Cargando perfil…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Profile Header *//*}
        <div className="profile-header card">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            <Avatar className="h-24 w-24 border-4 border-primary">
              {profile.photo ? (
                <AvatarImage src={profile.photo} />
              ) : (
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {profile.name ? profile.name[0] : "U"}
                </AvatarFallback>
              )}
            </Avatar>

            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-bold mb-2">{profile.name || t('profile.noName')}</h1>
              <p className="text-muted-foreground mb-4">
                {profile.description || t('profile.addDescription')}
              </p>

              <div className="flex flex-wrap gap-4 justify-center md:justify-start text-sm text-muted-foreground">
                <button onClick={() => navigate("/edit-profile")} className="btn-edit">
                  <FaEdit /> {t('profile.editProfile')}
                </button>
                <button onClick={() => navigate("/change-password")} className="btn-change">
                  <FaLock /> {t('profile.changePassword')}
                </button>
                <button onClick={handleLogout} className="btn-logout">
                  <FaSignOutAlt /> {t('profile.logout')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
*/