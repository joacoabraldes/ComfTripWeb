// src/components/OptimizedImage.jsx
import React, { useState } from "react";

export default function OptimizedImage({
  src,
  alt = "",
  width = 400,
  height = 260,
  ...rest
}) {
  const [error, setError] = useState(false);
  const ratio = `${width}/${height}`;

  if (!src || error) {
    return (
      <div
        className="img-frame img-fallback"
        style={{
          aspectRatio: ratio,
          width: "100%",
          borderRadius: "0.75rem",
          background: "#f3f3f3",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.9rem",
        }}
      >
        Sin imagen
      </div>
    );
  }

  return (
    <div
      className="img-frame"
      style={{
        aspectRatio: ratio,
        width: "100%",
        overflow: "hidden",
        borderRadius: "0.75rem",
        background: "#f3f3f3",
      }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setError(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
        {...rest}
      />
    </div>
  );
}
