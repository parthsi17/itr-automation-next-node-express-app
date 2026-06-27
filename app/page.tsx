"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import StartRunForm from "./components/StartRunForm";

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000";
const TOKEN = process.env.NEXT_PUBLIC_API_TOKEN ?? "";

type Job = {
  jobId: string;
  panMasked: string;
  phase: string;
  status: string;
  startedAt?: string;
  durationMs?: number;
  createdAt: string;
};

type Metrics = {
  total: number;
  successes: number;
  failures: number;
  successRate: number;
  p50Ms: number | null;
  p99Ms: number | null;
};

const STATUS_CLASSES: Record<string, string> = {
  RUNNING:     "badge badge-running",
  WAITING_OTP: "badge badge-waiting",
  SUCCESS:     "badge badge-success",
  FAILED:      "badge badge-failed",
  CANCELLED:   "badge badge-cancelled",
};

function fmtDur(ms?: number | null) {
  if (!ms) return "—";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function fmtTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString();
}

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
  const authHeaders = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

  async function loadJobs() {
    const p = new URLSearchParams();
    if (statusFilter) p.set("status", statusFilter);
    if (phaseFilter) p.set("phase", phaseFilter);
    const r = await fetch(`${API}/jobs?${p}`, { headers: authHeaders, cache: "no-store" });
    if (r.ok) setJobs(await r.json());
  }

  async function loadMetrics() {
    const r = await fetch(`${API}/metrics`, { cache: "no-store" });
    if (r.ok) setMetrics(await r.json());
  }

  useEffect(() => { loadJobs(); loadMetrics(); }, [statusFilter, phaseFilter]);

  // Global SSE — re-fetch whenever any job changes
  useEffect(() => {
    const src = new EventSource(`${API}/stream`);
    src.onmessage = () => { loadJobs(); loadMetrics(); };
    src.onerror = () => src.close();
    return () => src.close();
  }, [statusFilter, phaseFilter]);

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>

      {/* Metrics strip */}
      {metrics && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "0.75rem", marginBottom: "2rem" }}>
          {[
            { label: "Total runs",   value: String(metrics.total) },
            { label: "Successes",    value: String(metrics.successes) },
            { label: "Failures",     value: String(metrics.failures) },
            { label: "Success rate", value: `${metrics.successRate}%` },
            { label: "p50 / p99",    value: `${fmtDur(metrics.p50Ms)} / ${fmtDur(metrics.p99Ms)}` },
          ].map((m) => (
            <div key={m.label} style={{
              border: "1px solid #e2e8f0", borderRadius: 10, padding: "0.9rem 1.1rem", background: "#fff",
            }}>
              <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {m.label}
              </div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, marginTop: 2 }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Start new run */}
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "1.25rem 1.5rem", marginBottom: "2rem", background: "#fff" }}>
        <h2 style={{ margin: "0 0 1rem", fontSize: "1rem", fontWeight: 700 }}>Start new run</h2>
        <StartRunForm backendUrl={API} apiToken={TOKEN} />
      </div>

      {/* Filters + table */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontSize: "1rem" }}>All runs</span>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "4px 10px", fontSize: "0.83rem" }}>
          <option value="">All statuses</option>
          {["RUNNING","WAITING_OTP","SUCCESS","FAILED","CANCELLED"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)}
          style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "4px 10px", fontSize: "0.83rem" }}>
          <option value="">All phases</option>
          {["CREATED","OPENING_PORTAL","ENTERING_PAN","SOLVING_CAPTCHA","WAITING_OTP","ENTERING_OTP","SETTING_PASSWORD","SUCCESS","FAILED","CANCELLED"].map((p) => <option key={p}>{p}</option>)}
        </select>
      </div>

      {jobs.length === 0 ? (
        <p style={{ color: "#94a3b8", padding: "2rem 0" }}>No runs yet. Start one above.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                {["Job ID","PAN","Status","Phase","Started","Duration",""].map((h) => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.jobId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: "0.78rem", color: "#94a3b8" }}>
                    {job.jobId.slice(0, 8)}…
                  </td>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{job.panMasked}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span className={STATUS_CLASSES[job.status] ?? "badge"}>{job.status}</span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#475569" }}>{job.phase}</td>
                  <td style={{ padding: "10px 12px", color: "#94a3b8", whiteSpace: "nowrap" }}>
                    {fmtTime(job.startedAt ?? job.createdAt)}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{fmtDur(job.durationMs)}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <Link href={`/runs/${job.jobId}`}
                      style={{ color: "#f97316", fontWeight: 600, textDecoration: "none", fontSize: "0.8rem" }}>
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
