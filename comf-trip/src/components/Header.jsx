// src/components/Header.tsx
// src/components/Header.tsx
import { useState } from "react";
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
}
