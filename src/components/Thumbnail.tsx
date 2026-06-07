import { memo, useMemo, useState } from "react";
import { resolveMediaUrl } from "../lib/media";
import type { ThumbnailObject } from "../types/invidious";

interface ThumbnailProps {
  src?: string;
  sources?: ThumbnailObject[];
  alt: string;
  baseUrl: string;
  ratio?: number;
  squareBottomCorners?: boolean;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
  sizes?: string;
}

const ThumbnailBase = ({
  src,
  sources,
  alt,
  baseUrl,
  ratio = 16 / 9,
  squareBottomCorners = false,
  loading = "lazy",
  fetchPriority = "auto",
  sizes = "(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 33vw",
}: ThumbnailProps): JSX.Element => {
  const safeSrc = useMemo(() => resolveMediaUrl(src, baseUrl), [src, baseUrl]);
  const srcSet = useMemo(() => {
    if (!sources || sources.length === 0) return undefined;
    const seen = new Set<string>();
    const candidates: string[] = [];

    for (let index = 0; index < sources.length; index += 1) {
      const item = sources[index];
      if (!Number.isFinite(item?.width) || item.width <= 0 || !item.url) continue;

      const candidate = `${resolveMediaUrl(item.url, baseUrl)} ${item.width}w`;
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      candidates.push(candidate);
    }

    return candidates.length > 0 ? candidates.join(", ") : undefined;
  }, [sources, baseUrl]);
  const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1280' height='720' viewBox='0 0 1280 720'%3E%3Crect width='100%25' height='100%25' fill='%231A202C'/%3E%3C/svg%3E";
  const [loadedSrc, setLoadedSrc] = useState<string>("");
  const effectiveSrc = safeSrc || placeholder;
  const isLoaded = loadedSrc === effectiveSrc;

  return (
    <div
      aria-busy={!isLoaded}
      style={{
        position: "relative",
        width: "100%",
        overflow: "hidden",
        borderTopLeftRadius: "4px",
        borderTopRightRadius: "4px",
        borderBottomLeftRadius: squareBottomCorners ? "0" : "4px",
        borderBottomRightRadius: squareBottomCorners ? "0" : "4px",
        backgroundColor: "#1c1c1c",
        aspectRatio: ratio.toString(),
      }}
    >
      {!isLoaded && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(110deg, rgba(255,255,255,0.04) 8%, rgba(255,255,255,0.12) 18%, rgba(255,255,255,0.04) 33%) #202020",
            backgroundSize: "220% 100%",
            animation: "thumbShimmer 1.2s ease-in-out infinite",
          }}
        />
      )}
      <img
        src={safeSrc || placeholder}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          opacity: isLoaded ? 1 : 0,
          transition: "opacity 160ms ease",
        }}
        onLoad={() => {
          setLoadedSrc(effectiveSrc);
        }}
        onError={(e) => {
          e.currentTarget.src = placeholder;
          setLoadedSrc(placeholder);
        }}
      />
    </div>
  );
};

export const Thumbnail = memo(ThumbnailBase);
