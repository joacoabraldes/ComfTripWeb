// src/auth/AuthProvider.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { apiPost } from "../pages/api"; // your apiPost helper

const STORAGE_KEY = "myapp_auth_v1";

const AuthContext = createContext({
  user: null,
  token: null,
  isAuthenticated: false,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const isAuthenticated = !!token;

  // hydrate from storage (compat: check legacy token/user too)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setToken(parsed.token || null);
        setUser(parsed.user || null);
        return;
      }
      // compatibility: if older code wrote separate keys
      const legacyToken = localStorage.getItem("token");
      const legacyUser = localStorage.getItem("user");
      if (legacyToken) {
        setToken(legacyToken);
        setUser(legacyUser ? JSON.parse(legacyUser) : null);
        // persist into unified storage
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ token: legacyToken, user: legacyUser ? JSON.parse(legacyUser) : null })
        );
      }
    } catch (err) {
      console.warn("Auth hydrate error", err);
    }
  }, []);

  // persist
  useEffect(() => {
    if (token) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user }));
      // keep legacy keys (so other parts remain compatible)
      localStorage.setItem("token", token);
      if (user) localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  }, [token, user]);

  /**
   * LOGIN
   * Accepts credential object in any of these shapes:
   *  - { identifier, password }
   *  - { username, password }
   *  - { email, password }
   *
   * Preferred request sent to server: { identifier, password }
   * Fallback: if server doesn't return token and credentials.email existed,
   *           try { email, password } once (legacy support).
   */
  const login = async (credentials) => {
    if (!credentials || !credentials.password) {
      throw new Error("Missing credentials");
    }

    // determine identifier priority: explicit identifier > username > email
    const identifierRaw =
      credentials.identifier ?? credentials.username ?? credentials.email ?? "";
    const identifier = typeof identifierRaw === "string" ? identifierRaw.trim() : "";

    // Build preferred payload
    const preferredPayload = { identifier, password: credentials.password };

    // Attempt preferred flow first
    let res;
    try {
      res = await apiPost("/auth/login", preferredPayload);
      // If response doesn't contain token and the caller provided an email, try legacy shape
      if ((!res || !res.token) && credentials.email) {
        // fallback to legacy: { email, password }
        const fallbackRes = await apiPost("/auth/login", {
          email: String(credentials.email).trim().toLowerCase(),
          password: credentials.password,
        });
        res = fallbackRes;
      }
    } catch (err) {
      // If apiPost throws, attempt fallback only if email was provided
      if (credentials.email) {
        try {
          const fallbackRes = await apiPost("/auth/login", {
            email: String(credentials.email).trim().toLowerCase(),
            password: credentials.password,
          });
          res = fallbackRes;
        } catch (err2) {
          // bubble original error (or err2)
          throw err2 || err;
        }
      } else {
        throw err;
      }
    }

    if (!res || !res.token) {
      throw new Error(res?.message || "Invalid login response");
    }

    setToken(res.token);
    setUser(res.user || null);
    return res;
  };

  /**
   * REGISTER
   * Accepts payload and forwards to /auth/register.
   * Normalizes email to lower-case if present and forwards username if provided.
   */
  const register = async (payload) => {
    if (!payload || !payload.password) {
      throw new Error("Missing registration payload");
    }

    // normalize email if present
    const normalized = {
      ...payload,
      email: payload.email ? String(payload.email).trim().toLowerCase() : undefined,
      username: payload.username ? String(payload.username).trim() : undefined,
    };

    const res = await apiPost("/auth/register", normalized);

    if (res?.token) {
      setToken(res.token);
      setUser(res.user || null);
    }

    return res;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export default AuthProvider;
