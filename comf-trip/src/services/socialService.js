// src/services/socialService.js

const RAW_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:4000/api";
const API_BASE_URL = RAW_BASE_URL.replace(/\/$/, "");

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : undefined,
  };
}

export async function fetchSocialFeed({ limit = 20, offset = 0 } = {}) {
  const url = `${API_BASE_URL}/social/feed?limit=${limit}&offset=${offset}`;
  const res = await fetch(url, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Error al cargar el feed (${res.status}): ${
        text || res.statusText || "Error desconocido"
      }`
    );
  }

  return res.json();
}

export async function createSocialPost({ content, tripId, locationId, images }) {
  const body = {
    content,
    trip_id: tripId || null,
    location_id: locationId || null,
    images: images || null,
  };

  const res = await fetch(`${API_BASE_URL}/social/posts`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Error al crear el post (${res.status}): ${
        text || res.statusText || "Error desconocido"
      }`
    );
  }

  return res.json();
}

export async function togglePostLike(postId) {
  const res = await fetch(`${API_BASE_URL}/social/posts/${postId}/like`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Error al cambiar el like (${res.status}): ${
        text || res.statusText || "Error desconocido"
      }`
    );
  }

  return res.json();
}

export async function fetchPostComments(postId) {
  const res = await fetch(`${API_BASE_URL}/social/posts/${postId}/comments`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Error al cargar comentarios (${res.status}): ${
        text || res.statusText || "Error desconocido"
      }`
    );
  }

  return res.json();
}

export async function addPostComment(postId, content) {
  const res = await fetch(`${API_BASE_URL}/social/posts/${postId}/comments`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ content }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Error al crear comentario (${res.status}): ${
        text || res.statusText || "Error desconocido"
      }`
    );
  }

  return res.json();
}
