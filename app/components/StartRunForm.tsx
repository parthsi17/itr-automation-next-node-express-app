"use client";

import { useState } from "react";

type Props = {
  backendUrl: string;
};

export default function StartRunForm({ backendUrl }: Props) {
  const [pan, setPan] = useState("");
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
      setError("PAN must be in uppercase AAAAA9999A format.");
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch(`${backendUrl}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pan }),
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Unable to create run");
      }

      const { jobId } = await response.json();
      window.location.href = `/runs/${jobId}`;
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="pan" className="block text-sm font-medium text-slate-700">
          PAN Number
        </label>
        <input
          id="pan"
          type="text"
          value={pan}
          onChange={(e) => setPan(e.target.value.toUpperCase())}
          placeholder="AAAAA9999A"
          className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={isCreating}
        className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {isCreating ? "Starting run…" : "Start Run"}
      </button>
    </form>
  );
}
