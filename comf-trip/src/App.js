// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import RegisterPage from "./pages/Register";
import Trips from "./pages/Trips";
import AddTrip from "./pages/AddTrip";
import LoadTrip from "./pages/LoadTrip";
import ErrorPage from "./pages/Error";
import Profile from "./pages/Profile";
import ChangePassword from "./pages/ChangePassword";

import { AuthProvider } from "./auth/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/register" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/add-trip" element={<AddTrip />} />
          <Route path="/load-trip" element={<LoadTrip />} />

          <Route
            path="/trips"
            element={
              <ProtectedRoute>
                <Trips />
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          <Route
            path="/change-password"
            element={
              <ProtectedRoute>
                <ChangePassword />
              </ProtectedRoute>
            }
          />

          <Route path="/error" element={<ErrorPage />} />

          {/* fallback: send to error */}
          <Route path="*" element={<Navigate to="/error" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
