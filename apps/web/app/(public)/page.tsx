import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
        <div className="pointer-events-none fixed inset-0">
          <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="absolute bottom-[-180px] right-[-120px] h-[520px] w-[520px] rounded-full bg-emerald-400/[0.08] blur-3xl" />
        </div>

      <div className="relative mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs text-white/55">CREDIT REPORT INTELLIGENCE ENGINE</div>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">Credit Strategy AI</h1>
            <p className="mt-3 max-w-2xl text-sm text-white/60">
              Upload a credit report PDF, get structured findings, then approve bureau-specific dispute letter drafts.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-400/15"
              href="/login"
            >
              Sign in
            </Link>
            <Link
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
              href="/dashboard"
            >
              Open dashboard
            </Link>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs text-white/55">1</div>
            <div className="mt-2 text-lg font-semibold">Upload PDF</div>
            <div className="mt-2 text-sm text-white/60">Direct upload to secure storage (up to ~50MB).</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs text-white/55">2</div>
            <div className="mt-2 text-lg font-semibold">AI extraction</div>
            <div className="mt-2 text-sm text-white/60">Normalize into UI-ready JSON: accounts, negatives, strategy.</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs text-white/55">3</div>
            <div className="mt-2 text-lg font-semibold">Approve drafts</div>
            <div className="mt-2 text-sm text-white/60">You control what goes into the final dispute letters.</div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-black/60 p-6 backdrop-blur-xl">
          <div className="text-sm font-semibold">Start now</div>
          <div className="mt-2 text-sm text-white/60">
            Sign in, upload a report, and watch the dashboard hydrate from <span className="text-emerald-200/90">analysis_json</span>.
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-400/15"
              href="/upload"
            >
              Upload a report
            </Link>
            <Link
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
              href="/dashboard"
            >
              View dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
