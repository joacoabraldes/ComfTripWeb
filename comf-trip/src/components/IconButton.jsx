import React from "react";

/**
 * IconButton Component - Reusable button with icon
 * @param {React.ReactNode} icon - Icon component to display
 * @param {function} onClick - Click handler
 * @param {string} className - Additional CSS classes
 * @param {string} title - Tooltip text
 * @param {string} ariaLabel - Accessibility label
 * @param {boolean} disabled - Whether button is disabled
 * @param {string} variant - Button variant: 'default' | 'muted' | 'menu'
 */
export default function IconButton({
  icon,
  onClick,
  className = "",
  title,
  ariaLabel,
  disabled = false,
  variant = "default",
}) {
  const baseClass = variant === "menu" ? "trip-menu-btn" : "icon-btn";
  const variantClass = variant === "muted" ? "muted" : "";
  const combinedClass = `${baseClass} ${variantClass} ${className}`.trim();

  return (
    <button
      className={combinedClass}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel || title}
      disabled={disabled}
    >
      {icon}
    </button>
  );
}

