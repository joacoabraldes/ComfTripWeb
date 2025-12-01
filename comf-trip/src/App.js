// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import RegisterPage from "./pages/Register";
import Trips from "./pages/Trips";
import AddTrip from "./pages/AddTrip";
import EditTrip from "./pages/EditTrip";
import LoadTrip from "./pages/LoadTrip";
import ErrorPage from "./pages/Error";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import ChangePassword from "./pages/ChangePassword";
import MapPage from "./pages/Map";
import Home from "./pages/Home";
import TripItinerary from "./pages/TripItinerary";
import InterestsPage from "./pages/Interests"; // add this import
import Explore from "./pages/Explore";
import Community from "./pages/Community";
import FriendProfile from "./pages/friendProfile";

// ... inside <Routes>



import { AuthProvider } from "./auth/AuthProvider";
import { LanguageProvider } from "./i18n";
import ProtectedRoute from "./components/ProtectedRoute";
import AddPlace from "./pages/AddPlace";
import EditPlace from "./pages/EditPlace";
import Layout from "./components/Layout";

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/register" replace />} />

          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<RegisterPage />} />


          {/* Protected routes - require authentication */}
            <Route path="/home" element={<ProtectedRoute><Layout><Home /></Layout></ProtectedRoute>} />
            <Route path="/explore" element={<ProtectedRoute><Layout><Explore /></Layout></ProtectedRoute>} />
            <Route path="/add-trip" element={<ProtectedRoute><Layout><AddTrip /></Layout></ProtectedRoute>} />
            <Route path="/load-trip" element={<ProtectedRoute><LoadTrip /></ProtectedRoute>} />
            <Route path="/edit-trip/:tripId" element={<ProtectedRoute><Layout><EditTrip /></Layout></ProtectedRoute>} />
            <Route
            path="/trips"
            element={
              <ProtectedRoute>
                <Layout><Trips /></Layout>
              </ProtectedRoute>
            }
          />

            <Route
                path="/edit-place/:tripId"
                element={
                    <ProtectedRoute>
                        <Layout><EditPlace /></Layout>
                    </ProtectedRoute>
                }
            />

          <Route
            path="/map"
            element={
              <ProtectedRoute>
                <Layout><MapPage /></Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Layout><Profile /></Layout>
              </ProtectedRoute>
            }
          />
            <Route
                path="/edit-profile"
                element={
                    <ProtectedRoute>
                        <Layout><EditProfile /></Layout>
                    </ProtectedRoute>
                }
            />

          <Route
            path="/change-password"
            element={
              <ProtectedRoute>
                <Layout><ChangePassword /></Layout>
              </ProtectedRoute>
            }
          />
          <Route path="/interests" element={<ProtectedRoute><InterestsPage /></ProtectedRoute>} />

          <Route path="/error" element={<ErrorPage />} />

          <Route
            path="/trip_itinerary/:tripId"
            element={
              <ProtectedRoute>
                <Layout><TripItinerary /></Layout>
              </ProtectedRoute>
            }
          />
            <Route
                path="/add_place/:tripId"
                element={
                    <ProtectedRoute>
                        <Layout><AddPlace/></Layout>
                    </ProtectedRoute>
                }
            />
          <Route path="/community" element={<ProtectedRoute><Layout><Community /></Layout></ProtectedRoute>} />
          <Route path="/friend/:friendId" element={<ProtectedRoute><Layout><FriendProfile /></Layout></ProtectedRoute>} />

          {/* fallback: send to error */}
          <Route path="*" element={<Navigate to="/error" replace />} />
        </Routes>
      </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
