import React from "react";
import "../styles/empty-state.css";

/**
 * EmptyState Component - Displays a message when there's no data
 * @param {string} message - Main message to display
 * @param {string} subtitle - Optional subtitle
 * @param {React.ReactNode} icon - Optional icon component
 * @param {string} className - Additional CSS classes
 */
export default function EmptyState({ 
  message, 
  subtitle, 
  icon, 
  className = "" 
}) {
  return (
    <div className={`empty-state ${className}`}>
      {icon && <div className="empty-state-icon">{icon}</div>}
      <div className="empty-state-message">{message}</div>
      {subtitle && <div className="empty-state-subtitle">{subtitle}</div>}
    </div>
  );
}

