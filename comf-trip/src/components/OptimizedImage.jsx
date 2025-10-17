// src/components/OptimizedImage.jsx
import React, { useMemo, useState , useEffect, useRef} from "react";

function useInView({ root = null, rootMargin = "200px", threshold = 0 } = {}) {
    const ref = useRef(null);
    const [inView, setInView] = useState(false);

    useEffect(() => {
        if (!ref.current || inView) return; // ya visible
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
export default function OptimizedImage({
                                           src,
                                           alt = "",
                                           width = 400,
                                           height = 260,
                                           scrollRoot = null,   // pasamos el contenedor con scroll
                                           priority = false,    // fuerza carga inmediata
                                       }) {
    const { ref, inView } = useInView({ root: scrollRoot, rootMargin: "300px" });
    const [loaded, setLoaded] = useState(false);
    const [error, setError]   = useState(false);

    // solo setear el src real cuando está en vista (o priority)
    const realSrc = useMemo(() => (priority || inView ? src : null), [priority, inView, src]);

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
                    fetchPriority={priority ? "high" : "auto"}
                    onLoad={() => setLoaded(true)}
                    onError={() => setError(true)}
                    style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: loaded ? "block" : "none",
                    }}
                    referrerPolicy="no-referrer"
                    crossOrigin="anonymous"
                />
            ) : null}
            {error && <div className="img-fallback">Sin imagen</div>}
        </div>
    );
}
