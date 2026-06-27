"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  backendUrl: string;
  apiToken?: string;
};

export default function StartRunForm({ backendUrl, apiToken = "" }: Props) {
  const [pan, setPan] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
      setError("PAN must be uppercase AAAAA9999A format.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${backendUrl}/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
        },
        body: JSON.stringify({ pan }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to start run");
      }
      const { jobId } = await res.json();
      router.push(`/runs/${jobId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", flexWrap: "wrap" }}>
      <div>
        <input
          type="text"
          value={pan}
          onChange={(e) => setPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          placeholder="AAAAA9999A"
          maxLength={10}
          style={{
            border: "1px solid #e2e8f0", borderRadius: 8,
            padding: "8px 14px", fontSize: "0.95rem", outline: "none", width: 180,
          }}
        />
        {error && <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: 4 }}>{error}</p>}
      </div>
      <button
        type="submit"
        disabled={busy}
        style={{
          background: busy ? "#94a3b8" : "#f97316",
          color: "#fff", border: "none", borderRadius: 8,
          padding: "8px 20px", fontWeight: 700, fontSize: "0.9rem",
          cursor: busy ? "not-allowed" : "pointer",
        }}
      >
        {busy ? "Starting…" : "Start run"}
      </button>
    </form>
  );
}
