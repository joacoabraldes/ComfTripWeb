// src/api.js
const API_BASE = process.env.REACT_APP_API_URL || 'https://comf-trip-backend.vercel.app/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = options.headers || {};

  // if body is not FormData, assume JSON
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  const res = await fetch(API_BASE + path, {
    ...options,
    headers,
    body:
      headers['Content-Type'] === 'application/json' && options.body
        ? JSON.stringify(options.body)
        : options.body
  });

  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch (e) { data = text; }

  if (!res.ok) {
    // Attach status for easier handling in UI
    if (typeof data === "object") data.status = res.status;
    else data = { message: data, status: res.status };
    throw data;
  }
  return data;
}

export const apiPost = (path, body) => request(path, { method: 'POST', body });
export const apiGet  = (path) => request(path, { method: 'GET' });
export const apiPut  = (path, body) => request(path, { method: 'PUT', body });
export const apiDelete = (path) => request(path, { method: 'DELETE' });
