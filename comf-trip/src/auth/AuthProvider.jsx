// src/auth/AuthProvider.jsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { apiPost } from "../pages/api"; // <-- your apiPost used by pages/api.js

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
      // also keep legacy keys (so other parts remain compatible)
      localStorage.setItem("token", token);
      if (user) localStorage.setItem("user", JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
    }
  }, [token, user]);

  // login: calls your apiPost('/auth/login', credentials) and stores token/user
  const login = async (credentials) => {
    // credentials: { email, password }
    const res = await apiPost("/auth/login", credentials);
    // expecting res.token and res.user
    if (!res || !res.token) {
      throw new Error(res?.message || "Invalid login response");
    }
    setToken(res.token);
    setUser(res.user || null);
    return res;
  };

  // register: calls your apiPost('/auth/register', payload)
  const register = async (payload) => {
    const res = await apiPost("/auth/register", payload);
    // if signup returns token+user, store them; otherwise keep behavior minimal
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
