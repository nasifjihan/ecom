"use client";

/**
 * The whole layout crashed (rare): this replaces it, so there is no theme, menu or translator here.
 * Plain styles and both languages in one page.
 */
import * as React from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(error);
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) void import("@sentry/nextjs").then((S) => S.captureException(error));
  }, [error]);

  const button: React.CSSProperties = { padding: "10px 18px", borderRadius: 6, border: "1px solid #111", fontSize: 14, cursor: "pointer", textDecoration: "none" };
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", color: "#111", background: "#fff" }}>
        <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16, textAlign: "center" }}>
          <p style={{ fontSize: 56, fontWeight: 900, margin: 0 }}>500</p>
          <h1 style={{ fontSize: 22, margin: "16px 0 8px" }}>Something went wrong</h1>
          <p style={{ margin: 0, color: "#555" }}>Please try again in a moment.</p>
          <p lang="bn" style={{ margin: "4px 0 0", color: "#555" }}>কিছু একটা সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।</p>
          <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
            <button type="button" onClick={reset} style={{ ...button, background: "#111", color: "#fff" }}>
              Try again
            </button>
            <a href="/" style={{ ...button, color: "#111" }}>
              Home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
