import React from "react";
import "../styles/sidebar.css";
import { useNavigate } from "react-router-dom";

export default function Sidebar({ open, onClose }) {
  const navigate = useNavigate();

  function go(path) {
    navigate(path);
    if (onClose) onClose();
  }

  return (
    <nav className={`sidebar ${open ? "open" : ""}`}>
      {open && (
        <button className="sidebar-close-btn" onClick={onClose} aria-label="Cerrar menú">
          ➤
        </button>
      )}
      <ul>
        <li onClick={() => go("/home")}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 22V12H15V22M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg> Inicio
        </li>

        <li onClick={() => go("/explore")}>
          <svg width="24" height="24" viewBox="10 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path 
              d="M23 1C29.0751 1 34 5.92487 34 12C34 18.0751 29.0751 23 23 23C16.9249 23 12 18.0751 12 12C12 5.92487 16.9249 1 23 1ZM23 2.5C17.7533 2.5 13.5 6.75329 13.5 12C13.5 17.2467 17.7533 21.5 23 21.5C28.2467 21.5 32.5 17.2467 32.5 12C32.5 6.75329 28.2467 2.5 23 2.5ZM27.6901 7.8581C27.7637 8.06046 27.7637 8.28228 27.6901 8.48464L25.5612 13.4644C25.3759 13.9743 24.9742 14.3759 24.4644 14.5612L19.4846 16.6901C19.0088 16.8631 18.4829 16.6176 18.3099 16.1418C18.2364 15.9395 18.2364 15.7177 18.3099 15.5154L20.4388 10.5356C20.6242 10.0258 21.0258 9.62417 21.5356 9.43885L26.5154 7.30993C26.9911 7.13694 27.5171 7.38235 27.6901 7.8581ZM26.0621 8.93793L22.0054 10.7314C21.8969 10.7707 21.8071 10.8496 21.7542 10.9523L21.7313 11.0054L19.9379 15.0621L23.9946 13.2687C24.1032 13.2293 24.1929 13.1504 24.2458 13.0478L24.2687 12.9946L26.0621 8.93793Z"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg> Explorar
        </li>

        <li onClick={() => go("/trips")}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 21V5C16 4.46957 15.7893 3.96086 15.4142 3.58579C15.0391 3.21071 14.5304 3 14 3H10C9.46957 3 8.96086 3.21071 8.58579 3.58579C8.21071 3.96086 8 4.46957 8 5V21M4 7H20C21.1046 7 22 7.89543 22 9V19C22 20.1046 21.1046 21 20 21H4C2.89543 21 2 20.1046 2 19V9C2 7.89543 2.89543 7 4 7Z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg> Viajes
        </li>

        <li onClick={() => go("/map")}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 18L1 22V6L8 2M8 18L16 22M8 18V2M16 22L23 18V2L16 6M16 22V6M16 6L8 2" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg> Mapa
        </li>

        <li onClick={() => go("/community")}>
          {/* community / people icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 11C17.6569 11 19 9.65685 19 8C19 6.34315 17.6569 5 16 5C14.3431 5 13 6.34315 13 8C13 9.65685 14.3431 11 16 11Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 11C9.65685 11 11 9.65685 11 8C11 6.34315 9.65685 5 8 5C6.34315 5 5 6.34315 5 8C5 9.65685 6.34315 11 8 11Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 20C2 16.6863 4.68629 14 8 14H16C19.3137 14 22 16.6863 22 20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg> Comunidad
        </li>

      </ul>
    </nav>
  );
}
//  a