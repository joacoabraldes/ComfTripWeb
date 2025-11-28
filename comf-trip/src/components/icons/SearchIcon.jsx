import React from "react";
import { useTranslation } from "../../i18n";

export default function SearchIcon({ size = 24, color = "#1D1B20" }) {
  const { t } = useTranslation();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={t('common.search')}
      focusable="false"
    >
      <circle cx="10.5" cy="10.5" r="6.5" stroke={color} strokeWidth="2" fill="none" />
      <path d="M15 15l5 5" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}