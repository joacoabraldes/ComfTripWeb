import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/header.css";
import LogoSvg from "../components/LogoSvg";
import { FaUser, FaHome, FaCompass, FaSuitcase, FaMap, FaUsers, FaArrowLeft } from "react-icons/fa";
import { useTranslation } from "../i18n";

export default function Header() {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();

    const go = (path) => navigate(path);
    const isActive = (path) => location.pathname === path;

    const mainPages = ["/home", "/explore", "/trips", "/map", "/community", "/profile"];
    const isMainPage = mainPages.includes(location.pathname);
    const showBackButton = !isMainPage;

    const handleBack = () => {
        navigate(-1);
    };

    return (
        <header className="app-header">
            <div className="app-header-left">
                {showBackButton && (
                    <button 
                        className="back-button" 
                        onClick={handleBack}
                        aria-label={t('common.back')}
                    >
                        <FaArrowLeft size={20} />
                    </button>
                )}
                <LogoSvg height={60} width={80} />
            </div>

            <div className="app-header-center">
                <nav className="app-header-links">
                <button
                    className={`nav-btn ${isActive("/home") ? "active trips" : ""}`}
                    onClick={() => go("/home")}
                >
                    <FaHome size={24} color={isActive("/home") ? "white" : "black"} /> {t('common.home')}
                </button>

                <button className={`nav-btn ${isActive("/explore") ? "active trips" : ""}`} onClick={() => go("/explore")}>
                    <FaCompass size={24} color={isActive("/explore") ? "white" : "black"} /> {t('common.explore')}
                </button>

                <button
                    className={`nav-btn ${isActive("/trips") ? "active trips" : ""}`}
                    onClick={() => go("/trips")}
                >
                    <FaSuitcase size={24} color={isActive("/trips") ? "white" : "black"} /> {t('common.trips')}
                </button>

                <button className={`nav-btn ${isActive("/map") ? "active trips" : ""}`}
                        onClick={() => go("/map")}>
                    <FaMap size={24} color={isActive("/map") ? "white" : "black"} /> {t('common.map')}
                </button>

                <button className={`nav-btn ${isActive("/community") ? "active trips" : ""}`}
                        onClick={() => go("/community")}>
                    <FaUsers size={24} color={isActive("/community") ? "white" : "black"} /> {t('common.community')}
                </button>

            </nav></div>
            <nav className="app-header-right">
                <button
                    className={`nav-btn ${isActive("/profile") ? "active trips" : ""}`}
                    style={{width:"5rem"}}
                    onClick={() => go("/profile")}
                >
                    <FaUser size={30} />
                </button>
            </nav>
        </header>
    );
}
