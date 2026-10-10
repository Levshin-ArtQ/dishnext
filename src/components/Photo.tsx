import { useEffect, useMemo, useState } from "react";

const MEAL_CACHE = "dishnext-meals-v1";
const MEAL_FILE = /\/meals\/([^/?]+)\.(jpg|jpeg|png|webp)$/i;

export function mealSrc(url?: string, size?: "small" | "medium" | "large") {
  if (!url) return undefined;
  const cleaned = url.replace(/\/(small|medium|large)$/, "");
  if (size && /themealdb\.com\/images\/media\/meals\//.test(cleaned)) {
    return `${cleaned}/${size === "large" ? "medium" : size}`;
  }
  return cleaned;
}

export function localThumb(url?: string, size: "small" | "medium" | "large" = "medium") {
  if (!url) return undefined;
  const cleaned = url.split("?")[0].replace(/\/(small|medium|large)$/, "");
  if (cleaned.startsWith("/thumbs/")) {
    const file = cleaned.split("/").pop() ?? "";
    const stem = file.replace(/-md\.(jpg|jpeg|png|webp)$/i, "").replace(/\.(jpg|jpeg|png|webp)$/i, "");
    return size === "small" ? `/thumbs/${stem}.jpg` : `/thumbs/${stem}-md.jpg`;
  }
  const match = cleaned.match(MEAL_FILE);
  if (!match) return undefined;
  const stem = match[1];
  return size === "small" ? `/thumbs/${stem}.jpg` : `/thumbs/${stem}-md.jpg`;
}

export function resolveSrc(url?: string, size: "small" | "medium" | "large" = "medium") {
  return localThumb(url, size) ?? mealSrc(url, size);
}

export function Photo({
  src,
  alt,
  size = "medium",
  priority = false,
  className
}: {
  src?: string;
  alt: string;
  size?: "small" | "medium" | "large";
  priority?: boolean;
  className?: string;
}) {
  const tinyLocal = useMemo(() => localThumb(src, "small"), [src]);
  const fullLocal = useMemo(() => localThumb(src, size === "small" ? "small" : "medium"), [src, size]);
  const tinyRemote = useMemo(() => mealSrc(src, "small"), [src]);
  const fullRemote = useMemo(() => mealSrc(src, size === "small" ? "small" : "medium"), [src, size]);
  const [full, setFull] = useState(fullLocal ?? fullRemote);
  const [tiny, setTiny] = useState(tinyLocal ?? tinyRemote);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const nextFull = fullLocal ?? fullRemote;
    const nextTiny = tinyLocal ?? tinyRemote;
    setFull(nextFull);
    setTiny(nextTiny);
    setReady(false);
    setFailed(false);
    if (!nextFull) return;
    const probe = new Image();
    probe.src = nextFull;
    if (probe.complete && probe.naturalWidth > 0) setReady(true);
  }, [fullLocal, fullRemote, tinyLocal, tinyRemote]);

  if (!full || failed) {
    return (
      <div className={`photo ph ${className ?? ""}`} role="img" aria-label={alt}>
        <svg viewBox="0 0 120 90" width="100%" height="100%" aria-hidden="true">
          <rect width="120" height="90" fill="#f3d5c4" />
          <ellipse cx="60" cy="48" rx="28" ry="6" fill="#ff8a73" opacity=".45" />
          <path d="M38 50c2 16 10 24 22 24s20-8 22-24" fill="#fff7ec" />
        </svg>
      </div>
    );
  }

  const onFullError = () => {
    if (full === fullLocal && fullRemote && fullRemote !== full) {
      setReady(false);
      setFull(fullRemote);
      return;
    }
    setFailed(true);
  };

  const onTinyError = () => {
    if (tiny === tinyLocal && tinyRemote && tinyRemote !== tiny) setTiny(tinyRemote);
    else setTiny(undefined);
  };

  return (
    <div className={`photo ${ready ? "is-ready" : ""} ${className ?? ""}`}>
      {tiny && tiny !== full && (
        <img className="photo-blur" src={tiny} alt="" aria-hidden="true" decoding="async" onError={onTinyError} />
      )}
      <img
        className="photo-full"
        src={full}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "low"}
        onLoad={() => setReady(true)}
        onError={onFullError}
      />
    </div>
  );
}

export function preload(urls: (string | undefined)[], size: "small" | "medium" | "large" = "medium") {
  for (const src of urls) {
    const tiny = resolveSrc(src, "small");
    const full = resolveSrc(src, size);
    if (tiny) {
      const img = new Image();
      img.src = tiny;
    }
    if (full && full !== tiny) {
      const img = new Image();
      img.src = full;
    }
  }
}

export function warmCatalogImages(urls: (string | undefined)[]) {
  const smalls = [...new Set(urls.map((u) => resolveSrc(u, "small")).filter(Boolean))] as string[];
  const first = smalls.slice(0, 16);
  const later = (fn: () => void) => {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(() => fn(), { timeout: 2500 });
    else window.setTimeout(fn, 400);
  };
  later(() => {
    for (const src of first) {
      const img = new Image();
      img.src = src;
    }
  });
  later(async () => {
    try {
      const cache = await caches.open(MEAL_CACHE);
      for (const src of first) {
        if (await cache.match(src)) continue;
        try {
          const res = await fetch(src, { credentials: "omit" });
          if (res.ok) await cache.put(src, res);
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* Cache API may be missing */
    }
  });
}
