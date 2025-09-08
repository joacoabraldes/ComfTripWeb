import React from "react";

export default function UserIcon({ size = 24, color = "#1D1B20" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="perfil"
      focusable="false"
    >
      <circle cx="12" cy="8" r="3.2" fill={color} />
      <path d="M4 20c0-3.3 4-5.5 8-5.5s8 2.2 8 5.5" fill={color} />
    </svg>
  );
}
