"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000";
const TOKEN = process.env.NEXT_PUBLIC_API_TOKEN ?? "";

const PHASES = [
  "CREATED",
  "OPENING_PORTAL",
  "ENTERING_PAN",
  "SOLVING_CAPTCHA",
  "WAITING_OTP",
  "ENTERING_OTP",
  "SETTING_PASSWORD",
  "SUCCESS",
];

type EvtItem = {
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
  startedAt?: string;
  durationMs?: number;
  result?: { userId?: string; password?: string };
};

const authH = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

function levelColor(level?: string) {
  if (level === "ERROR") return "#ef4444";
  if (level === "WARN") return "#f59e0b";
  return "#334155";
}

function Stepper({ currentPhase, status }: { currentPhase: string; status: string }) {
  const idx = PHASES.indexOf(currentPhase);
  return (
    <div style={{ display: "flex", overflowX: "auto", gap: 0, marginBottom: "1.5rem" }}>
      {PHASES.map((ph, i) => {
        const done = i < idx || (ph === "SUCCESS" && status === "SUCCESS");
        const active = ph === currentPhase;
        return (
          <div key={ph} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 70 }}>
            <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
              {i > 0 && <div style={{ flex: 1, height: 2, background: done ? "#f97316" : "#e2e8f0" }} />}
              <div style={{
                width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                background: done ? "#f97316" : active ? "#fff7ed" : "#f1f5f9",
                border: `2px solid ${done || active ? "#f97316" : "#e2e8f0"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.65rem", fontWeight: 800,
                color: done ? "#fff" : active ? "#f97316" : "#94a3b8",
              }}>
                {done ? "✓" : i + 1}
              </div>
              {i < PHASES.length - 1 && <div style={{ flex: 1, height: 2, background: done ? "#f97316" : "#e2e8f0" }} />}
            </div>
            <span style={{ fontSize: "0.6rem", marginTop: 4, color: active ? "#f97316" : "#94a3b8", textAlign: "center", maxWidth: 64, lineHeight: 1.2 }}>
              {ph.replace(/_/g, " ")}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function RunPage() {
  const params = useParams();
  const jobId = (params?.id ?? "") as string;

  const [job, setJob] = useState<Job | null>(null);
  const [events, setEvents] = useState<EvtItem[]>([]);
  const [otp, setOtp] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpMsg, setOtpMsg] = useState("");
  const [autoscroll, setAutoscroll] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  async function loadJob() {
    const r = await fetch(`${API}/jobs/${jobId}`, { headers: authH, cache: "no-store" });
    if (r.ok) setJob(await r.json());
  }

  useEffect(() => { if (jobId) loadJob(); }, [jobId]);

  // SSE with Last-Event-ID replay on reconnect
  useEffect(() => {
    if (!jobId) return;
    let lastId = 0;

    function connect() {
      const url = lastId > 0 ? `${API}/stream/${jobId}` : `${API}/stream/${jobId}`;
      const src = new EventSource(url);

      src.onmessage = (e) => {
        const ev: EvtItem = JSON.parse(e.data);
        lastId = ev.seq;
        setEvents((prev) => {
          if (prev.some((p) => p.seq === ev.seq)) return prev;
          return [...prev, ev];
        });
        if (["SUCCESS", "FAILED", "CANCELLED"].includes(ev.phase)) loadJob();
      };

      src.onerror = () => {
        src.close();
        setTimeout(connect, 2000); // reconnect after blip
      };

      return src;
    }

    const src = connect();
    return () => src.close();
  }, [jobId]);

  // Auto-scroll
  useEffect(() => {
    if (autoscroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events, autoscroll]);

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    setOtpBusy(true);
    setOtpMsg("");
    try {
      const r = await fetch(`${API}/jobs/${jobId}/otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authH },
        body: JSON.stringify({ otp }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? "Failed");
      setOtpMsg("OTP submitted successfully.");
      setOtp("");
    } catch (err) {
      setOtpMsg(err instanceof Error ? err.message : "Error");
    } finally {
      setOtpBusy(false);
    }
  }

  async function cancelRun() {
    await fetch(`${API}/jobs/${jobId}/cancel`, { method: "POST", headers: authH });
    loadJob();
  }

  const isTerminal = ["SUCCESS", "FAILED", "CANCELLED"].includes(job?.status ?? "");
  const waitingOtp = job?.status === "WAITING_OTP";

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700 }}>
            {job?.panMasked ?? "Loading…"}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "0.78rem", color: "#94a3b8", fontFamily: "monospace" }}>{jobId}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          {!isTerminal && (
            <button onClick={cancelRun} style={{
              background: "none", border: "1px solid #e2e8f0", borderRadius: 8,
              padding: "5px 14px", fontSize: "0.82rem", cursor: "pointer", color: "#475569",
            }}>
              Cancel
            </button>
          )}
          <Link href="/" style={{ color: "#f97316", fontWeight: 600, fontSize: "0.85rem", textDecoration: "none" }}>
            ← Dashboard
          </Link>
        </div>
      </div>

      {/* Phase stepper */}
      {job && <Stepper currentPhase={job.phase} status={job.status} />}

      {/* OTP input */}
      {waitingOtp && (
        <div style={{
          border: "2px solid #f97316", borderRadius: 10,
          padding: "1rem 1.25rem", marginBottom: "1.5rem", background: "#fff7ed",
        }}>
          <p style={{ margin: "0 0 0.75rem", fontWeight: 700, color: "#c2410c" }}>
            OTP required — enter the code from the registered mobile/email
          </p>
          <form onSubmit={submitOtp} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="OTP"
              maxLength={8}
              style={{
                border: "1px solid #fdba74", borderRadius: 8,
                padding: "7px 12px", fontSize: "1rem", width: 130,
              }}
            />
            <button type="submit" disabled={otpBusy || !otp} style={{
              background: !otp || otpBusy ? "#94a3b8" : "#f97316",
              color: "#fff", border: "none", borderRadius: 8,
              padding: "7px 18px", fontWeight: 700,
              cursor: !otp || otpBusy ? "not-allowed" : "pointer",
            }}>
              {otpBusy ? "Submitting…" : "Submit OTP"}
            </button>
          </form>
          {otpMsg && <p style={{ marginTop: 6, fontSize: "0.82rem", color: "#475569" }}>{otpMsg}</p>}
        </div>
      )}

      {/* Credentials on success */}
      {job?.result?.userId && (
        <div style={{
          border: "1px solid #bbf7d0", borderRadius: 10,
          padding: "1rem 1.25rem", marginBottom: "1.5rem", background: "#f0fdf4",
        }}>
          <p style={{ margin: "0 0 4px", fontWeight: 700, color: "#166534" }}>Credentials generated</p>
          <p style={{ margin: "2px 0", fontSize: "0.9rem" }}>User ID: <strong>{job.result.userId}</strong></p>
          <p style={{ margin: "2px 0", fontSize: "0.9rem" }}>Password: <strong>{job.result.password}</strong></p>
        </div>
      )}

      {/* FAILED banner */}
      {job?.status === "FAILED" && (
        <div style={{ border: "1px solid #fecaca", borderRadius: 10, padding: "0.75rem 1.25rem", marginBottom: "1.5rem", background: "#fef2f2" }}>
          <p style={{ margin: 0, color: "#991b1b", fontWeight: 600 }}>Run failed — see event log for details</p>
        </div>
      )}

      {/* Live event log */}
      <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, background: "#fff" }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "0.6rem 1rem", borderBottom: "1px solid #f1f5f9",
        }}>
          <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>
            Event log <span style={{ color: "#94a3b8", fontWeight: 400 }}>({events.length})</span>
          </span>
          <button onClick={() => setAutoscroll((v) => !v)} style={{
            background: autoscroll ? "#f97316" : "#f1f5f9",
            color: autoscroll ? "#fff" : "#475569",
            border: "none", borderRadius: 6, padding: "3px 10px",
            fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
          }}>
            {autoscroll ? "Auto-scroll ON" : "Auto-scroll OFF"}
          </button>
        </div>
        <div
          ref={logRef}
          style={{ height: 360, overflowY: "auto", padding: "0.75rem 1rem" }}
          onScroll={(e) => {
            const el = e.currentTarget;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            if (!atBottom) setAutoscroll(false);
          }}
        >
          {events.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Waiting for events…</p>
          ) : (
            events.map((ev) => (
              <div key={ev.seq} style={{ marginBottom: "0.4rem", fontFamily: "monospace", fontSize: "0.81rem", lineHeight: 1.5 }}>
                <span style={{ color: "#cbd5e1", marginRight: 8 }}>#{String(ev.seq).padStart(3, "0")}</span>
                <span style={{ marginRight: 8, fontWeight: 700, color: levelColor(ev.level) }}>{ev.phase}</span>
                <span style={{ color: levelColor(ev.level) }}>{ev.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
