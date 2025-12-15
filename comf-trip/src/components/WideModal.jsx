// src/components/WideModal.jsx
import React from "react";
import { FaTimes } from "react-icons/fa";
import "../styles/modal.css";

/**
 * WideModal Component - Modal wrapper with inline sizing (no locked .modal-content width)
 * Props are the same as Modal, plus:
 * @param {object} contentStyle - extra inline styles for the content container
 */
export default function WideModal({
  isOpen,
  onClose,
  children,
  className = "",
  closeOnOverlayClick = true,
  disabled = false,
  contentStyle = {},
}) {
  if (!isOpen) return null;

  const handleOverlayClick = () => {
    if (closeOnOverlayClick && !disabled) onClose();
  };

  const handleContentClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        className={`modal-content ${className}`}
        onClick={handleContentClick}
        style={{
          width: "min(1200px, calc(100vw - 20rem))",
          maxWidth: "calc(100vw - 2rem)",
          boxSizing: "border-box",
          overflowX: "hidden",
          ...contentStyle,
        }}
      >
        <button
          className="modal-close"
          onClick={onClose}
          disabled={disabled}
          aria-label="Close modal"
        >
          <FaTimes size={20} />
        </button>

        {children}
      </div>
    </div>
  );
}
