"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("M3E Canvas error:", error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        boxSizing: "border-box",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <section style={{ maxWidth: 520, width: "100%" }}>
        <p style={{ margin: "0 0 8px", fontSize: 13, opacity: 0.7 }}>M3E Canvas</p>
        <h1 style={{ margin: "0 0 12px", fontSize: 28 }}>Something went wrong</h1>
        <p style={{ margin: "0 0 20px", lineHeight: 1.6, opacity: 0.8 }}>
          The editor hit an unexpected error. Your saved project data is kept separately from this screen.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            minHeight: 48,
            padding: "0 20px",
            border: 0,
            borderRadius: 24,
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Try again
        </button>
      </section>
    </main>
  );
}
