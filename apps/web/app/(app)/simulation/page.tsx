'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';

type Acct = {
  creditor_name?: string | null;
  balance?: number | null;
  credit_limit?: number | null;
};

function pct(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `${Math.round(n)}%`;
}

export default function SimulationPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paydown, setPaydown] = useState<number>(250);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return router.push('/login');
      const { data, error } = await supabase
        .from('reports')
        .select('analysis_json')
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) return setError(error.message);
      setAnalysis((data || [])[0]?.analysis_json ?? null);
    })();
  }, [router, supabase]);

  const accounts: Acct[] = Array.isArray(analysis?.accounts) ? analysis.accounts : [];
  const balances = accounts
    .map((a) => (typeof a.balance === 'number' ? a.balance : null))
    .filter((v): v is number => typeof v === 'number');
  const limits = accounts
    .map((a) => (typeof a.credit_limit === 'number' ? a.credit_limit : null))
    .filter((v): v is number => typeof v === 'number');

  const totalBalance = balances.reduce((a, b) => a + b, 0);
  const totalLimit = limits.reduce((a, b) => a + b, 0);
  const currentUtil = totalLimit > 0 ? (totalBalance / totalLimit) * 100 : null;
  const newUtil = totalLimit > 0 ? (Math.max(0, totalBalance - paydown) / totalLimit) * 100 : null;

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4">
        <div className="text-xs text-white/55">SIMULATION</div>
        <h1 className="mt-1 text-2xl font-semibold">What-if utilization</h1>
        <div className="mt-1 text-sm text-white/60">Adjust payoff and see instant utilization impact (math, not AI).</div>
      </div>

      {error ? <div className="text-sm text-red-200">{error}</div> : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs text-white/55">Current utilization</div>
          <div className="mt-2 text-3xl font-semibold">{pct(currentUtil)}</div>
          <div className="mt-2 text-xs text-white/55">Based on accounts.balance / accounts.credit_limit.</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-xs text-white/55">Pay down</div>
          <input
            type="range"
            min={0}
            max={Math.max(0, Math.round(totalBalance || 0))}
            value={paydown}
            onChange={(e) => setPaydown(Number(e.target.value))}
            className="mt-4 w-full"
          />
          <div className="mt-2 text-sm text-white/70">${paydown}</div>
        </div>
        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-5">
          <div className="text-xs text-emerald-100/80">New utilization</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-100">{pct(newUtil)}</div>
          <div className="mt-2 text-xs text-emerald-100/70">Target band: 9-29% (fast win).</div>
        </div>
      </div>
    </div>
  );
}
