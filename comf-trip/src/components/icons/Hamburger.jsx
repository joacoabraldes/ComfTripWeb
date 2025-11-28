import React from "react";
import { useTranslation } from "../../i18n";

export default function Hamburger({ width = 38, height = 25, color = "#1D1B20" }) {
  const { t } = useTranslation();
  const barWidth = 26;
  const barHeight = 3.5;
  const offsetX = (width - barWidth) / 2;
  const r = barHeight / 2;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={t('common.menu')}
      focusable="false"
    >
      <rect x={offsetX} y="2" width={barWidth} height={barHeight} rx={r} fill={color} />
      <rect
        x={offsetX}
        y={(height - barHeight) / 2 - 1}
        width={barWidth}
        height={barHeight}
        rx={r}
        fill={color}
      />
      <rect
        x={offsetX}
        y={height - barHeight - 2}
        width={barWidth}
        height={barHeight}
        rx={r}
        fill={color}
      />
    </svg>
  );
}
