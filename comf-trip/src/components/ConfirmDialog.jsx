import React from "react";
import { useTranslation } from "../i18n";
import Modal from "./Modal";
import ActionButton from "./ActionButton";
import "../styles/confirm-dialog.css";

/**
 * ConfirmDialog Component - Replaces window.confirm with a styled modal
 * @param {boolean} isOpen - Whether dialog is open
 * @param {function} onClose - Function to call when dialog closes
 * @param {function} onConfirm - Function to call when user confirms
 * @param {string} title - Dialog title
 * @param {string} message - Dialog message
 * @param {string} confirmText - Confirm button text (optional)
 * @param {string} cancelText - Cancel button text (optional)
 * @param {string} variant - Confirm button variant (default: 'primary')
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  variant = "primary",
}) {
  const { t } = useTranslation();

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="confirm-dialog">
        {title && <h3>{title}</h3>}
        <p>{message}</p>
        <div className="confirm-dialog-actions">
          <ActionButton variant="ghost" onClick={onClose}>
            {cancelText || t('common.cancel')}
          </ActionButton>
          <ActionButton variant={variant} onClick={handleConfirm}>
            {confirmText || t('common.confirm')}
          </ActionButton>
        </div>
      </div>
    </Modal>
  );
}

