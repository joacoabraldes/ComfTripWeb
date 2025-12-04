// src/components/social/CommentsSection.jsx
import React, { useEffect, useState } from 'react';
import { fetchComments, createComment } from '../services/socialService';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString();
}

export default function CommentsSection({ postId }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    if (!showComments) return;

    let isMounted = true;
    setLoading(true);
    fetchComments(postId)
      .then((data) => {
        if (!isMounted) return;
        setComments(data || []);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [postId, showComments]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const comment = await createComment(postId, newComment.trim());
      setComments((prev) => [...prev, comment]);
      setNewComment('');
    } catch (err) {
      console.error(err);
      alert('No se pudo publicar el comentario');
    } finally {
      setSubmitting(false);
    }
  };

  const toggle = () => setShowComments((prev) => !prev);

  return (
    <div className="comments-section">
      <button
        type="button"
        onClick={toggle}
        style={{
          fontSize: 13,
          padding: '4px 8px',
          borderRadius: 6,
          border: '1px solid #ddd',
          backgroundColor: '#fafafa',
          cursor: 'pointer',
          marginBottom: 8,
        }}
      >
        {showComments ? 'Ocultar comentarios' : 'Ver comentarios'}
      </button>

      {showComments && (
        <>
          {loading ? (
            <div style={{ fontSize: 13, color: '#777' }}>Cargando comentarios...</div>
          ) : (
            <div style={{ marginBottom: 8 }}>
              {comments.length === 0 && (
                <div style={{ fontSize: 13, color: '#777' }}>
                  Aún no hay comentarios. Sé el primero en comentar.
                </div>
              )}
              {comments.map((c) => (
                <div
                  key={c.id}
                  style={{
                    borderTop: '1px solid #eee',
                    paddingTop: 6,
                    paddingBottom: 4,
                    marginTop: 6,
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {c.author_username ? `@${c.author_username}` : c.author_name || 'Usuario'}
                  </div>
                  <div style={{ fontSize: 13 }}>{c.content}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>
                    {formatDate(c.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Nuevo comentario */}
          <form onSubmit={handleSubmit}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Escribe un comentario..."
              rows={2}
              style={{
                width: '100%',
                resize: 'vertical',
                padding: 8,
                borderRadius: 6,
                border: '1px solid #ccc',
                fontSize: 13,
                marginBottom: 6,
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={submitting || !newComment.trim()}
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1px solid #007bff',
                  backgroundColor: submitting ? '#cfe3ff' : '#007bff',
                  color: '#fff',
                  cursor: submitting ? 'default' : 'pointer',
                  fontSize: 13,
                }}
              >
                {submitting ? 'Publicando...' : 'Comentar'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
