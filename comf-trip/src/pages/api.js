// src/api.js
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = options.headers || {};

  // si body no es FormData, asumimos JSON
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
    // lanza el error para manejarlo en los componentes
    throw data;
  }
  return data;
}

export const apiPost = (path, body) => request(path, { method: 'POST', body });
export const apiGet  = (path) => request(path, { method: 'GET' });
export const apiPut  = (path, body) => request(path, { method: 'PUT', body });
export const apiDelete = (path) => request(path, { method: 'DELETE' });
