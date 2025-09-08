import React from "react";
import "../styles/sidebar.css";

export default function Sidebar({ open, onClose }) {
    return (
        <nav className={`sidebar ${open ? "open" : ""}`}>
            {open && (
                <button className="sidebar-close-btn" onClick={onClose}>
                    ➤
                </button>
            )}
            <ul>
                <li onClick={onClose}>🏠 Inicio</li>
                <li onClick={onClose}>🧳 Viajes</li>
                <li onClick={onClose}>🗺️ Mapa</li>
            </ul>
        </nav>
    );
}
