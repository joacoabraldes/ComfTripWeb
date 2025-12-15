// src/components/social/PostCard.jsx
import React, { useState } from 'react';
import { toggleLike } from '../services/socialService';
import { useSnackbar } from '../contexts/SnackbarContext';
import { useTranslation } from '../i18n';
import CommentsSection from './CommentSection';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString();
}

export default function PostCard({ post, onPostUpdated }) {
  const { t } = useTranslation();
  const { showError } = useSnackbar();
  const [isLiking, setIsLiking] = useState(false);

  const handleToggleLike = async () => {
    if (isLiking) return;
    setIsLiking(true);
    try {
      const { liked } = await toggleLike(post.id);
      const likeDelta = liked ? 1 : -1;

      // Informo al padre que se actualizó
      onPostUpdated({
        ...post,
        liked_by_me: liked,
        like_count: Math.max(0, (post.like_count || 0) + likeDelta),
      });
    } catch (err) {
      console.error(err);
      showError(t('socialFeed.errorToggleLike'));
    } finally {
      setIsLiking(false);
    }
  };

  const likeLabel = post.like_count === 1 ? t('socialFeed.oneLike') : `${post.like_count || 0} ${t('socialFeed.likes')}`;
  const commentLabel =
    post.comment_count === 1
      ? t('socialFeed.oneComment')
      : `${post.comment_count || 0} ${t('socialFeed.comments')}`;

  const authorDisplay = post.author_username
    ? `@${post.author_username}`
    : post.author_name || t('socialFeed.user');

  return (
    <article
      className="post-card"
      style={{
        border: '1px solid #ddd',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        backgroundColor: '#fff',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <div>
          <strong>{authorDisplay}</strong>
          <div style={{ fontSize: 12, color: '#777' }}>
            {formatDate(post.created_at)}
          </div>
        </div>
        {/* Podrías agregar menú de opciones aquí */}
      </header>

      {/* Contenido */}
      <div style={{ marginBottom: 8, whiteSpace: 'pre-wrap' }}>{post.content}</div>

      {/* Imágenes (simple) */}
      {post.images && (
        <div style={{ marginBottom: 8 }}>
          {/* Si son URLs en array */}
          {Array.isArray(post.images) ? (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              {post.images.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`post-img-${idx}`}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 200,
                    objectFit: 'cover',
                    borderRadius: 6,
                  }}
                />
              ))}
            </div>
          ) : (
            // Si guardaste un string (por ejemplo, una sola URL)
            <img
              src={post.images}
              alt="post-img"
              style={{
                maxWidth: '100%',
                maxHeight: 200,
                objectFit: 'cover',
                borderRadius: 6,
              }}
            />
          )}
        </div>
      )}

      {/* Meta */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 14,
          color: '#555',
          marginBottom: 8,
        }}
      >
        <span>{likeLabel}</span>
        <span>{commentLabel}</span>
      </div>

      {/* Botones */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <button
          onClick={handleToggleLike}
          disabled={isLiking}
          style={{
            flex: 1,
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid #ccc',
            backgroundColor: post.liked_by_me ? '#e0f2ff' : '#f6f6f6',
            cursor: 'pointer',
          }}
        >
          {post.liked_by_me ? t('socialFeed.unlike') : t('socialFeed.like')}
        </button>
      </div>

      {/* Comentarios */}
      <CommentsSection postId={post.id} />
    </article>
  );
}
