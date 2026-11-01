"use client";

/** The sun/moon button (when the shop allows it): switches light / dark and remembers it for a year. */
import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { MODE_COOKIE } from "../../lib/theme-css";
import { useT } from "../../i18n/provider";

export function ModeSwitch({ className }: { className?: string }) {
  const t = useT();
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    document.cookie = `${MODE_COOKIE}=${next ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
    setDark(next);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? t("Light mode") : t("Dark mode")}
      title={dark ? t("Light mode") : t("Dark mode")}
      className={className ?? "relative p-2 rounded-md hover:bg-accent transition-colors"}
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
