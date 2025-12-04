// src/pages/SocialFeedPage.js
import React, { useEffect, useState } from "react";
import {
  fetchSocialFeed,
  createSocialPost,
  togglePostLike,
  fetchPostComments,
  addPostComment,
} from "../services/socialService";

function SocialFeedPage() {
  const [posts, setPosts] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [error, setError] = useState(null);
  const [newPost, setNewPost] = useState("");
  const [commentText, setCommentText] = useState({});
  const [loadingPostId, setLoadingPostId] = useState(null);
  const [commentsByPost, setCommentsByPost] = useState({});

  useEffect(() => {
    loadFeed();
  }, []);

  async function loadFeed() {
    try {
      setLoadingFeed(true);
      setError(null);
      const data = await fetchSocialFeed();
      setPosts(data);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error cargando el feed");
    } finally {
      setLoadingFeed(false);
    }
  }

  async function handleCreatePost(e) {
    e.preventDefault();
    if (!newPost.trim()) return;

    try {
      setLoadingPostId("new");
      const res = await createSocialPost({ content: newPost.trim() });

      const created =
        res.post || {
          id: res.id,
          content: res.content,
          user_id: res.user_id,
          created_at: res.created_at,
        };

      setPosts((prev) => [created, ...prev]);
      setNewPost("");
    } catch (err) {
      console.error(err);
      alert(err.message || "Error al crear el post");
    } finally {
      setLoadingPostId(null);
    }
  }

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
      alert(err.message || "Error cambiando like");
    } finally {
      setLoadingPostId(null);
    }
  }

  async function handleLoadComments(postId) {
    if (commentsByPost[postId]) return;

    try {
      const comments = await fetchPostComments(postId);
      setCommentsByPost((prev) => ({ ...prev, [postId]: comments }));
    } catch (err) {
      console.error(err);
      alert(err.message || "Error cargando comentarios");
    }
  }

  async function handleAddComment(e, postId) {
    e.preventDefault();
    const text = (commentText[postId] || "").trim();
    if (!text) return;

    try {
      const res = await addPostComment(postId, text);
      const newComment = res.comment || res;

      const existing = commentsByPost[postId] || [];
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: [...existing, newComment],
      }));
      setCommentText((prev) => ({ ...prev, [postId]: "" }));
    } catch (err) {
      console.error(err);
      alert(err.message || "Error agregando comentario");
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Social feed</h1>

      {/* Crear post */}
      <form onSubmit={handleCreatePost} className="mb-6">
        <textarea
          className="w-full border rounded p-2 mb-2"
          rows={3}
          placeholder="¿Qué querés compartir sobre tu viaje?"
          value={newPost}
          onChange={(e) => setNewPost(e.target.value)}
        />
        <button
          type="submit"
          disabled={loadingPostId === "new"}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
        >
          {loadingPostId === "new" ? "Publicando..." : "Publicar"}
        </button>
      </form>

      {/* Feed */}
      {loadingFeed && <p>Cargando feed...</p>}
      {error && (
        <p className="text-red-600 mb-2">
          {error}
        </p>
      )}

      {!loadingFeed && posts.length === 0 && <p>No hay posts todavía.</p>}

      {posts.map((post) => (
        <div
          key={post.id}
          className="border rounded mb-4 p-3 bg-white shadow-sm"
        >
          <div className="mb-1 text-sm text-gray-600">
            <strong>{post.author_name || "Usuario"}</strong>{" "}
            {post.author_username && (
              <span className="text-gray-500">@{post.author_username}</span>
            )}
          </div>
          <div className="mb-2 whitespace-pre-wrap">{post.content}</div>

          <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
            <button
              type="button"
              disabled={loadingPostId === post.id}
              onClick={() => handleToggleLike(post.id)}
              className="flex items-center gap-1"
            >
              <span>{post.liked_by_me ? "💙" : "🤍"}</span>
              <span>{post.like_count || 0} likes</span>
            </button>

            <button
              type="button"
              onClick={() => handleLoadComments(post.id)}
              className="underline"
            >
              Ver comentarios
            </button>
          </div>

          {/* Comentarios */}
          {commentsByPost[post.id] && (
            <div className="mt-2 border-t pt-2">
              {commentsByPost[post.id].length === 0 && (
                <p className="text-sm text-gray-500">
                  No hay comentarios todavía.
                </p>
              )}
              {commentsByPost[post.id].map((c) => (
                <div key={c.id} className="mb-1 text-sm">
                  <strong>{c.author_name || "Usuario"}</strong>: {c.content}
                </div>
              ))}
            </div>
          )}

          {/* Agregar comentario */}
          <form
            onSubmit={(e) => handleAddComment(e, post.id)}
            className="mt-2 flex gap-2"
          >
            <input
              type="text"
              className="flex-1 border rounded px-2 py-1 text-sm"
              placeholder="Escribir un comentario..."
              value={commentText[post.id] || ""}
              onChange={(e) =>
                setCommentText((prev) => ({
                  ...prev,
                  [post.id]: e.target.value,
                }))
              }
            />
            <button
              type="submit"
              className="text-sm bg-gray-800 text-white px-3 py-1 rounded"
            >
              Enviar
            </button>
          </form>
        </div>
      ))}
    </div>
  );
}

export default SocialFeedPage;
