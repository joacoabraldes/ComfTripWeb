import React from "react";
import { useTranslation } from "../i18n";
import "../styles/loading.css";

/**
 * LoadingSpinner Component - Reusable loading state
 * @param {string} message - Loading message (optional, defaults to translated 'common.loading')
 * @param {string} className - Additional CSS classes
 * @param {boolean} fullScreen - Whether to take full screen height (default: false)
 */
export default function LoadingSpinner({ 
  message, 
  className = "", 
  fullScreen = false 
}) {
  const { t } = useTranslation();
  const displayMessage = message || t('common.loading');
  const containerClass = fullScreen ? "loading-container fullscreen" : "loading-container";
  
  return (
    <div className={`${containerClass} ${className}`}>
      <div className="loading-spinner">
        <div className="spinner"></div>
        <div className="loading-message">{displayMessage}</div>
      </div>
    </div>
  );
}

