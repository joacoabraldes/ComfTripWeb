// src/services/socialService.js

// Si tenés REACT_APP_API_URL en .env, lo usamos; si no, usamos '/api' y CRA hace proxy.
const API_BASE =
  (process.env.REACT_APP_API_URL || '/api').replace(/\/$/, ''); // sin barra final

function getAuthHeaders({ isFormData = false } = {}) {
  const headers = {};
  try {
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch {
    // ignoramos errores de localStorage
  }

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
}

function buildUrl(path) {
  // path ya incluye /social/..., API_BASE ya incluye /api
  return `${API_BASE}${path}`;
}

async function handleJsonResponse(res, defaultError) {
  const text = await res.text();

  if (!res.ok) {
    throw new Error(text || defaultError);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || defaultError);
  }
}

// -------- FEED --------
export async function fetchSocialFeed() {
  const res = await fetch(buildUrl('/social/feed'), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleJsonResponse(res, 'Error cargando el feed');
}

// -------- CREAR POST (texto + opcional imagen) --------
export async function createSocialPost({ content, files }) {
  const trimmed = (content || '').trim();
  const hasFiles = Array.isArray(files) && files.length > 0;

  // Solo texto -> JSON normal
  if (!hasFiles) {
    const res = await fetch(buildUrl('/social/posts'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content: trimmed }),
    });

    return handleJsonResponse(res, 'Error al crear el post');
  }

  // Texto + imagen (o solo imagen) -> FormData
  const formData = new FormData();
  formData.append('content', trimmed); // puede ir vacío

  const file = files[0];
  if (file) {
    formData.append('image', file);
  }

  const res = await fetch(buildUrl('/social/posts'), {
    method: 'POST',
    headers: getAuthHeaders({ isFormData: true }), // sin Content-Type manual
    body: formData,
  });

  return handleJsonResponse(res, 'Error al crear el post');
}

// -------- LIKE / UNLIKE --------
export async function togglePostLike(postId) {
  const res = await fetch(buildUrl(`/social/posts/${postId}/like`), {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  return handleJsonResponse(res, 'Error cambiando like');
}

// -------- COMENTARIOS --------
export async function fetchPostComments(postId) {
  const res = await fetch(buildUrl(`/social/posts/${postId}/comments`), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  return handleJsonResponse(res, 'Error cargando comentarios');
}

export async function addPostComment(postId, content) {
  const res = await fetch(buildUrl(`/social/posts/${postId}/comments`), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ content }),
  });

  return handleJsonResponse(res, 'Error agregando comentario');
}
