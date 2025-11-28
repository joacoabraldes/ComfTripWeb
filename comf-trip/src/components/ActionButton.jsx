import React from "react";

/**
 * ActionButton Component - Reusable action button with variants
 * @param {string} variant - Button variant: 'primary' | 'secondary' | 'ghost' | 'create' | 'share'
 * @param {function} onClick - Click handler
 * @param {React.ReactNode} children - Button content
 * @param {boolean} disabled - Whether button is disabled
 * @param {string} className - Additional CSS classes
 * @param {string} type - Button type (default: 'button')
 */
export default function ActionButton({
  variant = "primary",
  onClick,
  children,
  disabled = false,
  className = "",
  type = "button",
}) {
  const variantClass = {
    primary: "btn",
    secondary: "btn-secondary",
    ghost: "btn ghost",
    create: "btn-create",
    share: "btn-share",
    edit: "edit-btn-primary",
  }[variant] || "btn";

  const combinedClass = `${variantClass} ${className}`.trim();

  return (
    <button
      type={type}
      className={combinedClass}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

