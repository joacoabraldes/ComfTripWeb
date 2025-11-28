import React from "react";
import "../styles/sidebar.css";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../i18n";
import { FaHome, FaCompass, FaSuitcase, FaMap, FaUsers, FaTimes } from "react-icons/fa";

export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  function go(path) {
    navigate(path);
    if (onClose) onClose();
  }

  return (
    <nav className={`sidebar ${open ? "open" : ""}`}>
      {open && (
        <button className="sidebar-close-btn" onClick={onClose} aria-label={t('common.closeMenu')}>
          <FaTimes size={20} />
        </button>
      )}
      <ul>
        <li onClick={() => go("/home")}>
          <FaHome size={24} color="white" /> {t('common.home')}
        </li>

        <li onClick={() => go("/explore")}>
          <FaCompass size={24} color="white" /> {t('common.explore')}
        </li>

        <li onClick={() => go("/trips")}>
          <FaSuitcase size={24} color="white" /> {t('common.trips')}
        </li>

        <li onClick={() => go("/map")}>
          <FaMap size={24} color="white" /> {t('common.map')}
        </li>

        <li onClick={() => go("/community")}>
          <FaUsers size={24} color="white" /> {t('common.community')}
        </li>

      </ul>
    </nav>
  );
}