import React from "react";
import { FaTimes } from "react-icons/fa";
import "../styles/modal.css";

/**
 * Modal Component - Reusable modal wrapper
 * @param {boolean} isOpen - Whether the modal is open
 * @param {function} onClose - Function to call when modal should close
 * @param {React.ReactNode} children - Modal content
 * @param {string} className - Additional CSS classes
 * @param {boolean} closeOnOverlayClick - Whether clicking overlay closes modal (default: true)
 * @param {boolean} disabled - Whether close actions are disabled (e.g., during loading)
 */
export default function Modal({
  isOpen,
  onClose,
  children,
  className = "",
  closeOnOverlayClick = true,
  disabled = false,
}) {
  if (!isOpen) return null;

  const handleOverlayClick = () => {
    if (closeOnOverlayClick && !disabled) {
      onClose();
    }
  };

  const handleContentClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className={`modal-content ${className}`} onClick={handleContentClick}>
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

