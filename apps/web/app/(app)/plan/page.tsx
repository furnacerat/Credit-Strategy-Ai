'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';

export default function PlanPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return router.push('/login');

      const { data, error } = await supabase
        .from('reports')
        .select('analysis_json')
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      setAnalysis((data || [])[0]?.analysis_json ?? null);
      setLoading(false);
    })();
  }, [router, supabase]);

  const plan = analysis?.improvement_plan ?? null;

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4">
        <div className="text-xs text-white/55">PLAN</div>
        <h1 className="mt-1 text-2xl font-semibold">Roadmap</h1>
        <div className="mt-1 text-sm text-white/60">0-30 / 30-90 / 90+ day actions, progress, and payoff targets.</div>
      </div>

      {error ? <div className="text-sm text-red-200">{error}</div> : null}

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        {loading ? (
          <div className="text-sm text-white/60">Loading…</div>
        ) : plan ? (
          <pre className="whitespace-pre-wrap text-xs text-white/70">{JSON.stringify(plan, null, 2)}</pre>
        ) : (
          <div className="text-sm text-white/60">No plan yet (analysis_json.improvement_plan is empty).</div>
        )}
      </div>
    </div>
  );
}
