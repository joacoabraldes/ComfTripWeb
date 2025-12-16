// src/contexts/SnackbarContext.jsx
import React, { createContext, useContext, useState, useCallback } from "react";
import Snackbar from "../components/Snackbar";

const SnackbarContext = createContext(null);

export function SnackbarProvider({ children }) {
  const [snackbars, setSnackbars] = useState([]);

  const showSnackbar = useCallback((message, type = "info", duration = 4000) => {
    const id = Date.now() + Math.random();
    const newSnackbar = { id, message, type, duration };
    
    setSnackbars((prev) => [...prev, newSnackbar]);

    return id;
  }, []);

  const removeSnackbar = useCallback((id) => {
    setSnackbars((prev) => prev.filter((snackbar) => snackbar.id !== id));
  }, []);

  const showSuccess = useCallback((message, duration) => {
    return showSnackbar(message, "success", duration);
  }, [showSnackbar]);

  const showError = useCallback((message, duration) => {
    return showSnackbar(message, "error", duration);
  }, [showSnackbar]);

  const showWarning = useCallback((message, duration) => {
    return showSnackbar(message, "warning", duration);
  }, [showSnackbar]);

  const showInfo = useCallback((message, duration) => {
    return showSnackbar(message, "info", duration);
  }, [showSnackbar]);

  return (
    <SnackbarContext.Provider
      value={{
        showSnackbar,
        showSuccess,
        showError,
        showWarning,
        showInfo,
      }}
    >
      {children}
      <div className="snackbar-container">
        {snackbars.map((snackbar) => (
          <Snackbar
            key={snackbar.id}
            message={snackbar.message}
            type={snackbar.type}
            duration={snackbar.duration}
            onClose={() => removeSnackbar(snackbar.id)}
          />
        ))}
      </div>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error("useSnackbar must be used within a SnackbarProvider");
  }
  return context;
}

