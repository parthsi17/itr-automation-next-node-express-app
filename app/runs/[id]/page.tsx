"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000";

type EventItem = {
  seq: number;
  phase: string;
  level?: string;
  message: string;
  createdAt?: string;
};

type Job = {
  jobId: string;
  panMasked: string;
  status: string;
  phase: string;
  updatedAt: string;
  result?: {
    userId?: string;
    password?: string;
  };
};

export default function RunPage() {
  const params = useParams();
  const jobId = params?.id ?? "";
  const [job, setJob] = useState<Job | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;

    fetch(`${BACKEND_URL}/jobs/${jobId}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Unable to load run details");
        return res.json();
      })
      .then(setJob)
      .catch((err) => setError(err.message));
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;

    const source = new EventSource(`${BACKEND_URL}/stream/${jobId}`);

    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as EventItem;
      setEvents((prev) => [...prev, data]);
    };

    source.onerror = () => {
      source.close();
    };

    return () => {
      source.close();
    };
  }, [jobId]);

  return (
    <main className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Run details</h1>
          <p className="mt-2 text-slate-600">Live event history for run {jobId}</p>
        </div>
        <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">
          Back to dashboard
        </Link>
      </div>

      {error ? <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</p> : null}

      {job ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">PAN: {job.panMasked}</p>
          <p className="mt-2 text-base">
            Status: <span className="font-semibold">{job.status}</span>
          </p>
          <p className="text-base">
            Phase: <span className="font-semibold">{job.phase}</span>
          </p>
          {job.result ? (
            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-slate-700">
              <p className="font-semibold">Generated credentials</p>
              <p>User ID: {job.result.userId}</p>
              <p>Password: {job.result.password}</p>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          Loading run details…
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Live events</h2>
        {events.length === 0 ? (
          <p className="mt-4 text-slate-600">Waiting for live events from the automation service...</p>
        ) : (
          <div className="mt-4 space-y-3">
            {events.map((event) => (
              <div key={`${event.seq}-${event.phase}-${event.createdAt ?? ""}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">{event.level ?? "info"}</div>
                <p className="mt-2 font-semibold text-slate-900">{event.phase}</p>
                <p className="mt-1 text-slate-700">{event.message}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
