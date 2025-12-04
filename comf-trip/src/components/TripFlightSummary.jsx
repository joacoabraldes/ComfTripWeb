// src/components/TripFlightSummary.jsx
import React, { useState } from "react";

/* -------------------------------------------------
   Small helpers (time, status, mapping)
   ------------------------------------------------- */

// Extract "HH:mm" from various formats (ISO, "HH:mm", Date, nested objects)
function extractHHmm(value) {
  if (!value) return "";

  // Date
  if (value instanceof Date) {
    const hh = String(value.getHours()).padStart(2, "0");
    const mm = String(value.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  // Object with local / utc / scheduledTimeLocal / scheduledTimeUtc
  if (typeof value === "object") {
    const candidate =
      value.local ||
      value.scheduledTimeLocal ||
      value.scheduledTimeUtc ||
      value.utc ||
      value.scheduled ||
      "";
    return extractHHmm(candidate);
  }

  const str = String(value);

  // ISO like "2025-01-01T14:35:00"
  if (str.includes("T")) {
    const timePart = str.split("T")[1] || "";
    return timePart.slice(0, 5); // HH:mm
  }

  // Plain "HH:mm" or "HH:mm:ss"
  const m = str.match(/(\d{2}:\d{2})/);
  if (m) return m[1];

  return "";
}

// Normalize any status string into a small set of states
function normalizeFlightStatus(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  if (!s) return "scheduled";
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("delay")) return "delayed";
  if (s.includes("board")) return "boarding";
  if (s.includes("depart") || s.includes("in air") || s.includes("airborne"))
    return "in_air";
  if (s.includes("land") || s.includes("arriv")) return "landed";
  return "scheduled";
}

// Map normalized status -> label + variant (used for tag color)
function statusConfigFor(normalized) {
  switch (normalized) {
    case "cancelled":
      return { label: "Cancelado", variant: "danger" };
    case "delayed":
      return { label: "Demorado", variant: "warning" };
    case "boarding":
      return { label: "Embarcando", variant: "info" };
    case "in_air":
      return { label: "En vuelo", variant: "primary" };
    case "landed":
      return { label: "Aterrizado", variant: "success" };
    default:
      return { label: "Programado", variant: "muted" };
  }
}

// Try to infer basic route info (airports, times, status) from raw AeroDataBox flight
function deriveBasicFlightInfoFromRaw(raw = {}) {
  if (!raw || typeof raw !== "object") return {};

  // AeroDataBox by code -> usually has departure/arrival objects
  const depObj =
    raw.departure ||
    raw.movement?.departure ||
    raw.movement ||
    raw.origin ||
    {};
  const arrObj =
    raw.arrival || raw.movement?.arrival || raw.destination || {};

  const depAirport = depObj.airport || raw.movement?.airport || {};
  const arrAirport = arrObj.airport || {};

  const fromIata =
    depAirport.iata ||
    depAirport.iataCode ||
    depAirport.iata_code ||
    depObj.iataCode ||
    depObj.iata ||
    depObj.iata_code ||
    "";
  const toIata =
    arrAirport.iata ||
    arrAirport.iataCode ||
    arrAirport.iata_code ||
    arrObj.iataCode ||
    arrObj.iata ||
    arrObj.iata_code ||
    "";

  const fromName =
    depAirport.name ||
    depAirport.municipality ||
    depAirport.city ||
    depObj.city ||
    "";
  const toName =
    arrAirport.name ||
    arrAirport.municipality ||
    arrAirport.city ||
    arrObj.city ||
    "";

  const depTimeRaw =
    depObj.scheduledTime ||
    depObj.scheduledTimeLocal ||
    depObj.scheduledTimeUtc ||
    depObj.local ||
    depObj.utc ||
    raw.movement?.scheduledTime ||
    raw.movement?.scheduledTimeLocal ||
    raw.movement?.scheduledTimeUtc ||
    raw.movement?.local ||
    raw.movement?.utc ||
    null;
  const arrTimeRaw =
    arrObj.scheduledTime ||
    arrObj.scheduledTimeLocal ||
    arrObj.scheduledTimeUtc ||
    arrObj.local ||
    arrObj.utc ||
    null;

  const departureTime = extractHHmm(depTimeRaw);
  const arrivalTime = extractHHmm(arrTimeRaw);

  const gate =
    depObj.gate ||
    depAirport.gate ||
    depObj.gateName ||
    depAirport.gateName ||
    "";

  const statusRaw =
    raw.status ||
    raw.flight?.status ||
    depObj.status ||
    raw.raw?.status ||
    "";
  const statusNormalized = normalizeFlightStatus(statusRaw);

  const airlineName =
    raw.airline?.name ||
    raw.operator?.name ||
    raw.raw?.airline?.name ||
    "";

  // Try to guess flight code: airline code + number
  const carrier =
    raw.carrierCode ||
    raw.carrier ||
    raw.airline?.iata ||
    raw.airline?.code ||
    (raw.flight?.iataNumber
      ? String(raw.flight.iataNumber).replace(/\d+/g, "")
      : "");
  const numberRaw =
    raw.number ||
    raw.flight?.number ||
    (raw.flight?.iataNumber
      ? String(raw.flight.iataNumber).replace(/[A-Za-z]+/g, "")
      : "");

  const carrierStr = (carrier || "").toString().trim();
  const numberStr = (numberRaw || "").toString().trim();

  let flightCodeRaw = "";

  if (carrierStr && numberStr) {
    // If the number already starts with the carrier (e.g. "FR 2436"),
    // don't prepend it again or we get "FRFR 2436".
    if (numberStr.toUpperCase().startsWith(carrierStr.toUpperCase())) {
      flightCodeRaw = numberStr;
    } else {
      flightCodeRaw = `${carrierStr}${numberStr}`;
    }
  } else {
    flightCodeRaw = carrierStr || numberStr;
  }

  // Normalize style: "FR2436" or "FR 2436" -> "FR 2436"
  let flightCode = (flightCodeRaw || "").replace(/\s+/g, "");
  const m = flightCode.match(/^([A-Z]{2,3})(\d+)$/);
  if (m) {
    flightCode = `${m[1]} ${m[2]}`;
  } else {
    flightCode = flightCodeRaw || "";
  }

  return {
    fromIata: fromIata || "",
    fromName: fromName || "",
    toIata: toIata || "",
    toName: toName || "",
    departureTime,
    arrivalTime,
    gate,
    statusNormalized,
    airlineName,
    flightCode,
  };
}

/**
 * Build a normalized summary from a react-select option that wraps a flight.
 * Shape expected:
 *   option = { value, label, meta?, raw? }
 */
export function buildSummaryFromSelectOption(option, { title = "Vuelo" } = {}) {
  if (!option) return null;
  const meta = option.meta || {};
  const raw = option.raw || {};

  const base = deriveBasicFlightInfoFromRaw(raw);

  // allow meta to override when available
  const fromIata = meta.origin?.iata || base.fromIata;
  const fromName = meta.origin?.name || base.fromName;
  const toIata = meta.destination?.iata || base.toIata;
  const toName = meta.destination?.name || base.toName;

  let departureTime = meta.departureTime || base.departureTime;
  let arrivalTime = meta.arrivalTime || base.arrivalTime;

  // if only meta.times exist as "HH:mm → HH:mm", parse that
  if ((!departureTime || !arrivalTime) && meta.times) {
    const parts = String(meta.times).split("→").map((s) => s.trim());
    if (!departureTime && parts[0]) departureTime = parts[0];
    if (!arrivalTime && parts[1]) arrivalTime = parts[1];
  }

  const gate = meta.gate || meta.origin?.gate || base.gate || "";
  const flightCode =
    meta.flightCode || base.flightCode || option.value || "";
  const statusNormalized = meta.status || base.statusNormalized || "scheduled";
  const { label: statusLabel, variant: statusVariant } =
    statusConfigFor(statusNormalized);

  return {
    title,
    flightCode,
    fromIata,
    fromName,
    toIata,
    toName,
    departureTime,
    arrivalTime,
    gate,
    statusLabel,
    statusVariant,
  };
}

/**
 * Convenience: backendFlightDetails in TripItinerary is already a select-style option.
 * So we just forward to buildSummaryFromSelectOption.
 */
export function buildSummaryFromBackendDetails(
  backendFlightDetails,
  { title = "Vuelo" } = {}
) {
  if (!backendFlightDetails) return null;
  return buildSummaryFromSelectOption(backendFlightDetails, { title });
}

/* -------------------------------------------------
   Visual component
   ------------------------------------------------- */

const STATUS_STYLES = {
  primary: { bg: "rgba(59,130,246,0.16)", color: "#1d4ed8" }, // en vuelo
  success: { bg: "rgba(22,163,74,0.16)", color: "#15803d" }, // aterrizado
  warning: { bg: "rgba(245,158,11,0.16)", color: "#b45309" }, // demorado
  danger: { bg: "rgba(239,68,68,0.16)", color: "#b91c1c" }, // cancelado
  info: { bg: "rgba(59,130,246,0.16)", color: "#1d4ed8" }, // embarcando
  muted: { bg: "rgba(148,163,184,0.18)", color: "#475569" }, // programado
};

export default function TripFlightSummary({ summary, onRefresh, onRemove }) {
  // Feedback state for the reload button
  const [refreshState, setRefreshState] = useState("idle"); // idle | loading | success | error

  if (!summary) return null;

  const {
    title = "Vuelo",
    flightCode,
    fromIata,
    fromName,
    toIata,
    toName,
    departureTime,
    arrivalTime,
    gate,
    statusLabel,
    statusVariant = "muted",
  } = summary;

  const styleCfg = STATUS_STYLES[statusVariant] || STATUS_STYLES.muted;

  const handleRefreshClick = async () => {
    if (!onRefresh || refreshState === "loading") return;
    try {
      setRefreshState("loading");
      const result = onRefresh();
      if (result && typeof result.then === "function") {
        await result;
      }
      setRefreshState("success");
      window.setTimeout(() => setRefreshState("idle"), 2000);
    } catch (err) {
      console.error("Error refreshing flight", err);
      setRefreshState("error");
      window.setTimeout(() => setRefreshState("idle"), 2500);
    }
  };

  let feedbackText = "";
  let feedbackColor = "#64748b";
  if (refreshState === "loading") {
    feedbackText = "Actualizando vuelo…";
    feedbackColor = "#64748b";
  } else if (refreshState === "success") {
    feedbackText = "Vuelo actualizado";
    feedbackColor = "#15803d";
  } else if (refreshState === "error") {
    feedbackText = "No se pudo actualizar el vuelo";
    feedbackColor = "#b91c1c";
  }

  return (
    <div
      className="trip-flight-summary"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Header row: "Vuelo" + código + estado */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#64748b",
            }}
          >
            {title}
          </span>
          {flightCode && (
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "#0f172a",
              }}
            >
              {flightCode}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {statusLabel && (
            <span
              style={{
                padding: "4px 10px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                backgroundColor: styleCfg.bg,
                color: styleCfg.color,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                whiteSpace: "nowrap",
              }}
            >
              {statusLabel}
            </span>
          )}
        </div>
      </div>

      {/* Main row: ORIGEN -> DESTINO with center arrow */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 18,
          marginTop: 2,
        }}
      >
        {/* Origin */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#94a3b8",
              marginBottom: 2,
            }}
          >
            Origen
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#0f172a",
                lineHeight: 1.1,
              }}
            >
              {fromIata || "—"}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#475569",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={fromName}
            >
              {fromName}
            </div>
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              color: "#0f172a",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <span style={{ fontWeight: 600 }}>
              {departureTime || "Hora —"}
            </span>
            {gate && (
              <span
                style={{
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                Gate {gate}
              </span>
            )}
          </div>
        </div>

        {/* Center arrow + line */}
        <div
          style={{
            flexShrink: 0,
            width: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: 2,
              background:
                "linear-gradient(90deg, rgba(148,163,184,0.25), rgba(148,163,184,0.05))",
              borderRadius: 999,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                background: "#ffffff",
                padding: "0 8px",
                borderRadius: 999,
                boxShadow: "0 0 0 1px rgba(148,163,184,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#64748b",
                }}
              >
                →
              </span>
            </div>
          </div>
        </div>

        {/* Destination */}
        <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
          <div
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#94a3b8",
              marginBottom: 2,
            }}
          >
            Destino
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "baseline",
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#0f172a",
                lineHeight: 1.1,
              }}
            >
              {toIata || "—"}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#475569",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={toName}
            >
              {toName}
            </div>
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              color: "#0f172a",
            }}
          >
            <span style={{ fontWeight: 600 }}>{arrivalTime || "Hora —"}</span>
          </div>
        </div>
      </div>

      {/* Actions: refresh (icon only) + remove (icon + text) */}
      {(onRefresh || onRemove) && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 12,
              marginTop: 6,
            }}
          >
            {onRefresh && (
              <button
                type="button"
                onClick={handleRefreshClick}
                disabled={refreshState === "loading"}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 6,
                  borderRadius: 999,
                  cursor:
                    refreshState === "loading" ? "default" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 0 1px rgba(148,163,184,0.25)",
                  opacity: refreshState === "loading" ? 0.75 : 1,
                }}
                title="Actualizar vuelo"
              >
                {/* New reload icon (SVG you provided) */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ display: "block", color: "#64748b" }}
                >
                  <path
                    d="M19.146 4.854l-1.489 1.489A8 8 0 1 0 12 20a8.094 8.094 0 0 0 7.371-4.886 1 1 0 1 0-1.842-.779A6.071 6.071 0 0 1 12 18a6 6 0 1 1 4.243-10.243l-1.39 1.39a.5.5 0 0 0 .354.854H19.5A.5.5 0 0 0 20 9.5V5.207a.5.5 0 0 0-.854-.353z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            )}

            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: "6px 8px",
                  borderRadius: 999,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  color: "#b91c1c",
                  boxShadow: "0 0 0 1px rgba(248,113,113,0.35)",
                }}
              >
                {/* Trash icon */}
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M9 3h6"
                    stroke="#b91c1c"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                  <path
                    d="M4 6h16"
                    stroke="#b91c1c"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                  <path
                    d="M18 6l-1 13a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 6"
                    stroke="#b91c1c"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M10 10v7"
                    stroke="#b91c1c"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                  <path
                    d="M14 10v7"
                    stroke="#b91c1c"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  Eliminar vuelo
                </span>
              </button>
            )}
          </div>

          {onRefresh && refreshState !== "idle" && (
            <div
              style={{
                marginTop: 4,
                fontSize: 12,
                textAlign: "right",
                color: feedbackColor,
              }}
            >
              {feedbackText}
            </div>
          )}
        </>
      )}
    </div>
  );
}
