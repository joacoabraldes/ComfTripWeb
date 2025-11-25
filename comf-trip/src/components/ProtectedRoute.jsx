// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useTranslation } from "../i18n";

/**
 * Wrap route element to protect it.
 * Usage in routes:
 * <Route path="/trips" element={<ProtectedRoute><Trips/></ProtectedRoute>} />
 */
const ProtectedRoute = ({ children }) => {
  const { token,user, hydrated} = useAuth();
  const { t } = useTranslation();
  
  if (!hydrated) {
    return <div>{t('protectedRoute.loading')}</div>;
  }
  if (!token || !user) {
    // redirect to error page (you can change to '/login' if preferred)
    return <Navigate to="/error" replace />;
  }

  return children;
};

export default ProtectedRoute;
