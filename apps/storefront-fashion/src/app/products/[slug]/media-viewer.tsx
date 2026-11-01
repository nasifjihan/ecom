"use client";

/**
 * Full-screen photos (product gallery, review photos): swipe between them, pinch or double-tap to
 * zoom, Escape or × to close. Uses Swiper's zoom, which the gallery already loads Swiper for.
 */
import * as React from "react";
import { createPortal } from "react-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Keyboard, Navigation, Zoom } from "swiper/modules";
import { PlayCircle, X } from "lucide-react";
import type { VideoEmbed } from "@ecom/utils";
import { useT } from "@ecom/storefront-base";
import "swiper/css/zoom";

export function MediaViewer({ images, start, alt, onClose }: { images: string[]; start: number; alt: string; onClose: () => void }) {
  const t = useT();
  const closeRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={alt} className="fixed inset-0 z-[60] bg-black/95">
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label={t("Close")}
        className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X className="h-6 w-6" />
      </button>
      <Swiper
        modules={[Zoom, Navigation, Keyboard]}
        zoom={{ maxRatio: 3 }}
        navigation
        keyboard
        initialSlide={start}
        className="h-full w-full [--swiper-navigation-color:#fff]"
      >
        {images.map((src, i) => (
          <SwiperSlide key={src + i}>
            <div className="swiper-zoom-container">
              <img src={src} alt={`${alt} ${i + 1}`} className="max-h-full max-w-full object-contain" />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
      <p className="pointer-events-none absolute bottom-4 left-0 right-0 text-center text-xs text-white/60">{t("Double-tap or pinch to zoom")}</p>
    </div>,
    document.body,
  );
}

/** On a computer, the photo enlarges under the mouse; a click (or tap) opens the full-screen viewer. */
export function HoverZoom({ src, alt, label, onOpen }: { src: string; alt: string; label: string; onOpen: () => void }) {
  const [origin, setOrigin] = React.useState<string | null>(null);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className="block h-full w-full cursor-zoom-in overflow-hidden"
      onMouseMove={(e) => {
        if (!window.matchMedia("(hover: hover)").matches) return;
        const r = e.currentTarget.getBoundingClientRect();
        setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
      }}
      onMouseLeave={() => setOrigin(null)}
    >
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-cover transition-transform duration-150"
        style={origin ? { transform: "scale(2)", transformOrigin: origin } : undefined}
      />
    </button>
  );
}

/** The product's video: a still with a play button, loading the player only when tapped. */
export function ProductVideo({ video, poster, title }: { video: VideoEmbed; poster?: string; title: string }) {
  const t = useT();
  const [playing, setPlaying] = React.useState(false);
  if (playing)
    return video.kind === "file" ? (
      <video src={video.src} controls autoPlay playsInline className="h-full w-full bg-black object-contain" />
    ) : (
      <iframe
        src={`${video.src}${video.src.includes("?") ? "&" : "?"}autoplay=1`}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className="h-full w-full border-0 bg-black"
      />
    );
  return (
    <button type="button" onClick={() => setPlaying(true)} aria-label={t("Play video")} className="relative block h-full w-full bg-black">
      {poster && <img src={poster} alt="" className="h-full w-full object-cover opacity-70" />}
      <PlayCircle className="absolute inset-0 m-auto h-16 w-16 text-white drop-shadow-lg" />
    </button>
  );
}
