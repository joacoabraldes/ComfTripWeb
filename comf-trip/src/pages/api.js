// src/api.js
const API_BASE = 'https://comf-trip-backend.vercel.app/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = options.headers || {};

  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = 'Bearer ' + token;

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
    throw data;
  }
  return data;
}

export const apiPost = (path, body) => request(path, { method: 'POST', body });
export const apiGet  = (path) => request(path, { method: 'GET' });
export const apiPut  = (path, body) => request(path, { method: 'PUT', body });
export const apiDelete = (path) => request(path, { method: 'DELETE' });
