// src/components/Layout.jsx
import React from "react";
import Header from "./Header";
import "../styles/layout.css";

export default function Layout({ children }) {
    return (
        <div className="app-layout">
            <Header />
            <main className="app-main">
                {children}
            </main>
        </div>
    );
}

