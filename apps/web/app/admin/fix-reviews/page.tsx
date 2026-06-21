"use client";

import { useState } from "react";

export default function FixReviewsPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFix = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin/fix-reviews", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to fix reviews");
        return;
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "40px", maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>Fix Broken Reviews</h1>
      <p style={{ marginBottom: 20, color: "#666" }}>
        This will find all reviews with fake Last.fm/iTunes/MusicBrainz IDs and replace them with real Spotify IDs.
      </p>

      <button
        onClick={handleFix}
        disabled={loading}
        style={{
          padding: "12px 24px",
          fontSize: 16,
          background: loading ? "#ccc" : "#0070f3",
          color: "white",
          border: "none",
          borderRadius: 8,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Fixing..." : "Fix Reviews"}
      </button>

      {error && (
        <div style={{ marginTop: 20, padding: 16, background: "#fee", borderRadius: 8, color: "#c00" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 20, padding: 16, background: "#efe", borderRadius: 8 }}>
          <h2 style={{ fontSize: 18, marginBottom: 10 }}>Success!</h2>
          <p><strong>Total broken reviews:</strong> {result.total}</p>
          <p><strong>Fixed:</strong> {result.fixed}</p>
          <p><strong>Failed:</strong> {result.failed}</p>

          {result.details?.fixed?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 16, marginBottom: 8 }}>Fixed Reviews:</h3>
              <ul style={{ fontSize: 14 }}>
                {result.details.fixed.map((item: any, i: number) => (
                  <li key={i}>
                    {item.name} - {item.oldId} → {item.newId}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.details?.failed?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 16, marginBottom: 8, color: "#c00" }}>Failed Reviews:</h3>
              <ul style={{ fontSize: 14, color: "#c00" }}>
                {result.details.failed.map((item: any, i: number) => (
                  <li key={i}>
                    {item.name} - {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
