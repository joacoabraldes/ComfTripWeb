// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

/**
 * Wrap route element to protect it.
 * Usage in routes:
 * <Route path="/trips" element={<ProtectedRoute><Trips/></ProtectedRoute>} />
 */
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    // redirect to error page (you can change to '/login' if preferred)
    return <Navigate to="/error" replace />;
  }

  return children;
};

export default ProtectedRoute;
