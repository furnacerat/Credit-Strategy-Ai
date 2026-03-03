'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';

export default function TrackingPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return router.push('/login');
      const { data, error } = await supabase
        .from('reports')
        .select('id,created_at,letter_drafts(id,bureau,status,created_at,approved_at),dispute_letters(id,bureau,created_at)')
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setReport((data || [])[0] ?? null);
      setLoading(false);
    })();
  }, [router, supabase]);

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4">
        <div className="text-xs text-white/55">TRACKING</div>
        <h1 className="mt-1 text-2xl font-semibold">Timeline</h1>
        <div className="mt-1 text-sm text-white/60">
          Draft -&gt; exported -&gt; sent -&gt; resolved (wiring in progress).
        </div>
      </div>

      {error ? <div className="text-sm text-red-200">{error}</div> : null}

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        {loading ? (
          <div className="text-sm text-white/60">Loading…</div>
        ) : !report ? (
          <div className="text-sm text-white/60">No report found.</div>
        ) : (
          <div className="space-y-3">
            <div className="text-sm text-white/80">
              Latest report: <span className="text-white">{new Date(report.created_at).toLocaleString()}</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {(report.letter_drafts || []).map((d: any) => (
                <div key={d.id} className="rounded-2xl border border-white/10 bg-black/40 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">{d.bureau}</div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                      {d.status}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-white/55">Created: {new Date(d.created_at).toLocaleString()}</div>
                  {d.approved_at ? (
                    <div className="mt-1 text-xs text-white/55">Approved: {new Date(d.approved_at).toLocaleString()}</div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="pt-2">
              <Link
                href="/disputes"
                className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-400/15"
              >
                Open dispute center
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
