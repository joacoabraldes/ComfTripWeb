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
                <li onClick={onClose}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g clip-path="url(#clip0_326_2044)">
                        <path d="M9 22V12H15V22M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </g>
                    <defs>
                        <clipPath id="clip0_326_2044">
                            <rect width="24" height="24" fill="white"/>
                        </clipPath>
                    </defs>
                </svg> Inicio</li>
                <li onClick={onClose}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M16 21V5C16 4.46957 15.7893 3.96086 15.4142 3.58579C15.0391 3.21071 14.5304 3 14 3H10C9.46957 3 8.96086 3.21071 8.58579 3.58579C8.21071 3.96086 8 4.46957 8 5V21M4 7H20C21.1046 7 22 7.89543 22 9V19C22 20.1046 21.1046 21 20 21H4C2.89543 21 2 20.1046 2 19V9C2 7.89543 2.89543 7 4 7Z" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg> Viajes</li>
                <li onClick={onClose}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g clip-path="url(#clip0_326_2074)">
                        <path d="M8 18L1 22V6L8 2M8 18L16 22M8 18V2M16 22L23 18V2L16 6M16 22V6M16 6L8 2" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </g>
                    <defs>
                        <clipPath id="clip0_326_2074">
                            <rect width="24" height="24" fill="white"/>
                        </clipPath>
                    </defs>
                </svg> Mapa</li>
            </ul>
        </nav>
    );
}
