import React, { useEffect, useRef } from "react";

/**
 * DropdownMenu Component - Reusable dropdown menu
 * @param {boolean} isOpen - Whether menu is open
 * @param {function} onClose - Function to call when menu should close
 * @param {React.ReactNode} trigger - Trigger element (button, etc.)
 * @param {React.ReactNode} children - Menu content
 * @param {string} className - Additional CSS classes
 * @param {string} position - Menu position: 'right' | 'left' (default: 'right')
 */
export default function DropdownMenu({
  isOpen,
  onClose,
  trigger,
  children,
  className = "",
  position = "right",
}) {
  const menuRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <div className={`dropdown-menu-container ${className}`} ref={containerRef}>
      {trigger}
      {isOpen && (
        <div
          ref={menuRef}
          className={`dropdown-menu ${position}`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </div>
  );
}

