"use client";

import * as React from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, Navigation, EffectFade } from "swiper/modules";
import { ArrowRight } from "lucide-react";
import { Button } from "../ui";
import { cn } from "@ecom/utils";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";
import "swiper/css/effect-fade";

export type HeroSlide = {
  id: string | number;
  title: string;
  subtitle?: string;
  ctaText?: string;
  ctaHref?: string;
  backgroundImage?: string;
  bgGradient?: string;
  badge?: string;
  alignment?: "left" | "center" | "right";
  textColor?: "light" | "dark";
};

export type HeroSliderProps = {
  slides?: HeroSlide[];
  height?: number | string;
  autoPlay?: boolean;
  className?: string;
  showNavigation?: boolean;
  showPagination?: boolean;
  onSlideChange?: (index: number) => void;
};

const DEFAULT_SLIDES: HeroSlide[] = [
  {
    id: 1,
    badge: "Eid Collection 2026",
    title: "Eid Collection 2026 — Up to 50% OFF",
    subtitle: "Discover our exclusive festive collection for men, women and kids. Shop now and enjoy free delivery!",
    ctaText: "Shop Now →",
    ctaHref: "/products",
    bgGradient: "from-violet-500 via-purple-500 to-fuchsia-500",
    alignment: "left",
    textColor: "light",
  },
  {
    id: 2,
    badge: "Summer Sale",
    title: "Beat the Heat in Style",
    subtitle: "Lightweight summer essentials from ৳490 only. Limited time offer!",
    ctaText: "View Collection",
    ctaHref: "/categories/women",
    bgGradient: "from-amber-400 via-orange-500 to-red-500",
    alignment: "center",
    textColor: "light",
  },
  {
    id: 3,
    badge: "New Arrivals",
    title: "Men's Premium Collection",
    subtitle: "Premium quality shirts, panjabis and formal wear. Quality guaranteed.",
    ctaText: "Explore Now",
    ctaHref: "/categories/men",
    bgGradient: "from-slate-800 via-slate-900 to-black",
    alignment: "right",
    textColor: "light",
  },
];

export const HeroSlider: React.FC<HeroSliderProps> = ({
  slides = DEFAULT_SLIDES,
  height = "520px",
  autoPlay = true,
  className,
  showNavigation = true,
  showPagination = true,
  onSlideChange,
}) => {
  return (
    <div className={cn("relative w-full overflow-hidden rounded-xl bg-slate-100", className)} style={{ height }}>
      <Swiper
        modules={[Autoplay, Pagination, Navigation, EffectFade]}
        effect="fade"
        spaceBetween={0}
        slidesPerView={1}
        loop={slides.length > 1}
        autoplay={autoPlay ? { delay: 6000, disableOnInteraction: false } : false}
        pagination={
          showPagination
            ? { clickable: true, bulletActiveClass: "!bg-primary", bulletClass: "!h-2.5 !w-2.5 !opacity-60" }
            : false
        }
        navigation={showNavigation}
        onSlideChange={(swiper) => onSlideChange?.(swiper.activeIndex)}
        className="h-full w-full"
      >
        {slides.map((slide) => (
          <SwiperSlide key={slide.id} className="h-full">
            <div
              className={cn(
                "h-full w-full relative bg-gradient-to-br",
                slide.bgGradient ?? "from-primary to-primary/60",
              )}
            >
              {slide.backgroundImage && (
                <img
                  src={slide.backgroundImage}
                  alt={slide.title}
                  className="absolute inset-0 h-full w-full object-cover opacity-30"
                />
              )}

              <div
                className={cn(
                  "relative h-full w-full flex items-center px-6 md:px-12 lg:px-20",
                  slide.alignment === "center" && "justify-center text-center",
                  slide.alignment === "right" && "justify-end text-right",
                )}
              >
                <div
                  className={cn(
                    "max-w-2xl space-y-4 md:space-y-6 animate-fade-in",
                    slide.textColor === "light" ? "text-white" : "text-foreground",
                  )}
                >
                  {slide.badge && (
                    <span
                      className={cn(
                        "inline-block px-4 py-1.5 rounded-full text-sm font-semibold",
                        slide.textColor === "light"
                          ? "bg-white/20 backdrop-blur-sm border border-white/30"
                          : "bg-primary/10 text-primary border border-primary/20",
                      )}
                    >
                      {slide.badge}
                    </span>
                  )}
                  <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight drop-shadow-sm">
                    {slide.title}
                  </h1>
                  {slide.subtitle && (
                    <p
                      className={cn(
                        "text-base md:text-lg max-w-xl",
                        slide.textColor === "light" ? "text-white/90" : "text-muted-foreground",
                      )}
                    >
                      {slide.subtitle}
                    </p>
                  )}
                  {slide.ctaText && slide.ctaHref && (
                    <div className={cn("pt-2", slide.alignment === "center" && "mx-auto")}>
                      <Button
                        size="lg"
                        className={cn(
                          "group text-base",
                          slide.textColor === "light"
                            ? "bg-white text-slate-900 hover:bg-white/90"
                            : "bg-primary text-white hover:bg-primary/90",
                        )}
                        onClick={() => (window.location.href = slide.ctaHref!)}
                      >
                        {slide.ctaText}
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <svg className="absolute bottom-0 left-0 w-full h-24 text-white opacity-30" viewBox="0 0 1440 96" preserveAspectRatio="none">
                <path fill="currentColor" d="M0,32L48,37.3C96,43,192,53,288,53.3C384,53,480,43,576,37.3C672,32,768,32,864,37.3C960,43,1056,53,1152,48C1248,43,1344,21,1392,10.7L1440,0L1440,96L1392,96C1344,96,1248,96,1152,96C1056,96,960,96,864,96C768,96,672,96,576,96C480,96,384,96,288,96C192,96,96,96,48,96L0,96Z" />
              </svg>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default HeroSlider;
