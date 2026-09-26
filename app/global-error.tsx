"use client";

export default function GlobalError() {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          boxSizing: "border-box",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main style={{ maxWidth: 520 }}>
          <p style={{ margin: "0 0 8px", fontSize: 13, opacity: 0.7 }}>M3E Canvas</p>
          <h1 style={{ margin: "0 0 12px", fontSize: 28 }}>The editor could not start</h1>
          <p style={{ margin: "0 0 20px", lineHeight: 1.6, opacity: 0.8 }}>
            Reload the page to restart the application.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              minHeight: 48,
              padding: "0 20px",
              border: 0,
              borderRadius: 24,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
