import React, { useMemo, useState, useEffect, useRef } from "react";

function useInView({ root = null, rootMargin = "200px", threshold = 0 } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!ref.current || inView) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { root, rootMargin, threshold }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [root, rootMargin, threshold, inView]);

  return { ref, inView };
}

/**
 * OptimizedImage props:
 * - src: url string
 * - alt
 * - width, height: numbers for aspectRatio only (not used to request different images)
 * - scrollRoot: scroll container element (optional)
 * - priority: boolean (eager load)
 * - srcSet: optional string to pass directly to <img>
 * - sizes: optional string for responsive sizes
 */
export default function OptimizedImage({
  src,
  alt = "",
  width = 400,
  height = 260,
  scrollRoot = null,
  priority = false,
  srcSet = undefined,
  sizes = undefined,
}) {
  const { ref, inView } = useInView({ root: scrollRoot, rootMargin: "300px" });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const realSrc = useMemo(() => (priority || inView ? src : null), [priority, inView, src]);
  const loadingAttr = priority ? "eager" : "lazy";

  return (
    <div
      ref={ref}
      className="img-frame"
      style={{
        aspectRatio: `${width}/${height}`,
        width: "100%",
        position: "relative",
        overflow: "hidden",
        borderRadius: 12,
        background: "#f3f3f3",
      }}
    >
      {!loaded && !error && <div className="img-skeleton" />}
      {realSrc ? (
        <img
          src={realSrc}
          alt={alt}
          decoding="async"
          loading={loadingAttr}
          fetchPriority={priority ? "high" : undefined}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          srcSet={srcSet}
          sizes={sizes}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transition: "opacity 300ms ease",
            opacity: loaded ? 1 : 0,
            display: "block",
          }}
        />
      ) : null}
      {error && <div className="img-fallback">Sin imagen</div>}
    </div>
  );
}
