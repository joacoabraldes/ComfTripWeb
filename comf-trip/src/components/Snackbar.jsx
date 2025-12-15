// src/components/Snackbar.jsx
import React, { useEffect, useState, useCallback } from "react";
import "../styles/snackbar.css";

export default function Snackbar({ message, type = "info", onClose, duration = 4000 }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      if (onClose) onClose();
    }, 300); // Match CSS transition duration
  }, [onClose]);

  useEffect(() => {
    // Trigger entrance animation
    setIsVisible(true);

    // Auto close after duration
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, handleClose]);

  if (!isVisible && !isExiting) return null;

  return (
    <div
      className={`snackbar snackbar--${type} ${isExiting ? "snackbar--exiting" : ""}`}
      role="alert"
      aria-live="polite"
    >
      <div className="snackbar__content">
        <span className="snackbar__message">{message}</span>
        <button
          className="snackbar__close"
          onClick={handleClose}
          aria-label="Cerrar"
          type="button"
        >
          ×
        </button>
      </div>
    </div>
  );
}

