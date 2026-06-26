import StartRunForm from "./components/StartRunForm";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000";

type Job = {
  jobId: string;
  panMasked: string;
  phase: string;
  status: string;
  updatedAt: string;
  result?: {
    userId?: string;
    password?: string;
  };
};

async function getJobs(): Promise<Job[]> {
  const response = await fetch(`${BACKEND_URL}/jobs`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Unable to load runs from the automation service");
  }

  return response.json();
}

export default async function HomePage() {
  const jobs = await getJobs();

  return (
    <main className="p-8 max-w-6xl mx-auto space-y-10">
      <section>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">Income Tax Automation Dashboard</h1>
        <p className="mt-3 max-w-2xl text-lg leading-8 text-slate-600">
          Create a new automation run and monitor credential generation progress in real time.
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Start new run</h2>
        <p className="mt-2 text-slate-600">Enter a PAN to create a new automation job.</p>
        <div className="mt-6">
          <StartRunForm backendUrl={BACKEND_URL} />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold text-slate-900">Recent runs</h2>
        </div>

        <div className="mt-6 grid gap-4">
          {jobs.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
              No runs yet. Start one to see live progress.
            </div>
          ) : (
            jobs.map((job) => (
              <a
                key={job.jobId}
                href={`/runs/${job.jobId}`}
                className="block rounded-3xl border border-slate-200 bg-white p-6 transition hover:border-slate-400 hover:bg-slate-50"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold text-slate-900">{job.panMasked}</p>
                    <p className="text-sm text-slate-500">Run ID: {job.jobId}</p>
                  </div>
                  <div className="text-sm text-slate-700 sm:text-right">
                    <p>
                      Status: <span className="font-medium">{job.status}</span>
                    </p>
                    <p>
                      Phase: <span className="font-medium">{job.phase}</span>
                    </p>
                    <p>Updated: {new Date(job.updatedAt).toLocaleString()}</p>
                  </div>
                </div>
              </a>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
