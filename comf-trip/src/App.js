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
import ProtectedRoute from "./components/ProtectedRoute";
import AddPlace from "./pages/AddPlace";
import EditPlace from "./pages/EditPlace";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/register" replace />} />

          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<RegisterPage />} />


          {/* Protected routes - require authentication */}
            <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/explore" element={<ProtectedRoute><Explore /></ProtectedRoute>} />
            <Route path="/add-trip" element={<ProtectedRoute><AddTrip /></ProtectedRoute>} />
            <Route path="/load-trip" element={<ProtectedRoute><LoadTrip /></ProtectedRoute>} />
            <Route path="/edit-trip/:tripId" element={<ProtectedRoute><EditTrip /></ProtectedRoute>} />
            <Route
            path="/trips"
            element={
              <ProtectedRoute>
                <Trips />
              </ProtectedRoute>
            }
          />

            <Route
                path="/edit-place/:tripId"
                element={
                    <ProtectedRoute>
                        <EditPlace />
                    </ProtectedRoute>
                }
            />

          <Route
            path="/map"
            element={
              <ProtectedRoute>
                <MapPage />
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
                path="/edit-profile"
                element={
                    <ProtectedRoute>
                        <EditProfile />
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
          <Route path="/interests" element={<ProtectedRoute><InterestsPage /></ProtectedRoute>} />

          <Route path="/error" element={<ErrorPage />} />

          <Route
            path="/trip_itinerary/:tripId"
            element={
              <ProtectedRoute>
                <TripItinerary />
              </ProtectedRoute>
            }
          />
            <Route
                path="/add_place/:tripId"
                element={
                    <ProtectedRoute>
                        <AddPlace/>
                    </ProtectedRoute>
                }
            />
          <Route path="/community" element={<ProtectedRoute><Community /></ProtectedRoute>} />
          <Route path="/friend/:friendId" element={<ProtectedRoute><FriendProfile /></ProtectedRoute>} />

          {/* fallback: send to error */}
          <Route path="*" element={<Navigate to="/error" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
