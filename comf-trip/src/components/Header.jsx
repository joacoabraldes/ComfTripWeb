// src/components/Header.jsx
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/header.css";
import LogoSvg from "../components/LogoSvg";
import { FaHome, FaCompass, FaSuitcase, FaRegMap, FaUsers, FaUser} from "react-icons/fa";
import { useTranslation } from "../i18n";

export default function Header() {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();

    const go = (path) => navigate(path);
    const isActive = (path) => location.pathname === path;

    return (
        <header className="app-header">
            {/* Logo */}
            <div className="app-header-left">
                <LogoSvg height={60} width={80}/>
            </div>

            {/* Links */}
            <div className="app-header-center">
                <nav className="app-header-links">
                <button
                    className={`nav-btn ${isActive("/home") ? "active trips" : ""}`}
                    onClick={() => go("/home")}
                >
                    <FaHome size={24}/> {t('common.home')}
                </button>

                <button className={`nav-btn ${isActive("/explore") ? "active trips" : ""}`} onClick={() => go("/explore")}>
                    <FaCompass size={24}/>{t('common.explore')}
                </button>

                <button
                    className={`nav-btn ${isActive("/trips") ? "active trips" : ""}`}
                    onClick={() => go("/trips")}
                >
                    <FaSuitcase size={24}/>{t('common.trips')}
                </button>




                <button className={`nav-btn ${isActive("/map") ? "active trips" : ""}`}
                        onClick={() => go("/map")}>
                    <FaRegMap size={24} />{t('common.map')}
                </button>

                <button className={`nav-btn ${isActive("/community") ? "active trips" : ""}`}
                        onClick={() => go("/community")}>
                    <FaUsers size={24} />{t('common.community')}
                </button>



            </nav></div>
            <nav className="app-header-right">
                <button
                    className={`nav-btn ${isActive("/profile") ? "active trips" : ""}`}
                    style={{width:80}}
                    onClick={() => go("/profile")}
                >
                    <FaUser size={30} />
                </button>
            </nav>
        </header>
    );
}
// src/components/Header.tsx
// src/components/Header.tsx
{/*import { useState } from "react";
import { FaBars, FaUser } from "react-icons/fa";
import Sidebar from "./Sidebar";
import "../styles/header.css";
import { useNavigate } from "react-router-dom";

export default function Header() {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();

    return (
        <>
            <header className="app-header">
                <button className="icon-btn icon-left" onClick={() => setOpen(true)}>
                    <FaBars />
                </button>
                <button className="icon-btn icon-right" onClick={() => navigate("/profile")}>
                    <FaUser />
                </button>
            </header>

            <Sidebar open={open} onClose={() => setOpen(false)} />
        </>
    );
}*/}