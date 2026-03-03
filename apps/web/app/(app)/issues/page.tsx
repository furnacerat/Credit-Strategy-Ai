'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';

type Neg = {
  category?: string | null;
  type?: string | null;
  bureau?: string | null;
  creditor_name?: string | null;
  occurred_on?: string | null;
  amount?: number | null;
  severity_score?: number | null;
  estimated_score_impact?: string | null;
  dispute_recommendation?: string | null;
};

export default function IssuesPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [loading, setLoading] = useState(true);
  const [reportId, setReportId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [bureau, setBureau] = useState<string>('ALL');
  const [type, setType] = useState<string>('ALL');

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return router.push('/login');

      const { data, error } = await supabase
        .from('reports')
        .select('id,analysis_json')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      const row = (data || [])[0];
      if (!row?.id) {
        router.push('/upload');
        return;
      }
      setReportId(row.id);
      setAnalysis(row.analysis_json);
      setLoading(false);
    })();
  }, [router, supabase]);

  const items: Neg[] = Array.isArray(analysis?.negative_items) ? analysis.negative_items : [];

  const filtered = items.filter((it) => {
    const b = (it.bureau || '').toUpperCase();
    const cat = (it.category || it.type || '').toLowerCase();
    const bureauOk = bureau === 'ALL' || b === bureau;
    const typeOk = type === 'ALL' || cat === type;
    return bureauOk && typeOk;
  });

  const bureaus = Array.from(new Set(items.map((i) => (i.bureau || '').toUpperCase()).filter(Boolean))).sort();
  const types = Array.from(
    new Set(items.map((i) => (i.category || i.type || '').toLowerCase()).filter(Boolean))
  ).sort();

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-xs text-white/55">ISSUES</div>
          <h1 className="mt-1 text-2xl font-semibold">All negatives</h1>
          <div className="mt-1 text-sm text-white/60">
            Collections, charge-offs, lates, public records — filter and generate disputes.
          </div>
        </div>
        {reportId ? (
          <Link
            href={`/report/${reportId}`}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
          >
            Open report
          </Link>
        ) : null}
      </div>

      {error ? <div className="text-sm text-red-200">{error}</div> : null}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={bureau}
          onChange={(e) => setBureau(e.target.value)}
          className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
        >
          <option value="ALL">All bureaus</option>
          {bureaus.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
        >
          <option value="ALL">All types</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <div className="text-xs text-white/55">{loading ? 'Loading…' : `${filtered.length} items`}</div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {filtered.map((it, idx) => (
          <div key={idx} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-white">
                  {(it.category || it.type || 'negative_item').replace(/_/g, ' ')}
                  {it.creditor_name ? ` • ${it.creditor_name}` : ''}
                </div>
                <div className="mt-1 text-xs text-white/55">
                  {(it.bureau || '—').toUpperCase()} • {it.occurred_on || 'date unknown'}
                  {typeof it.amount === 'number' ? ` • $${it.amount}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                  severity {it.severity_score ?? '—'}
                </span>
                <button
                  className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-400/15"
                  onClick={() => router.push('/disputes')}
                >
                  Generate dispute
                </button>
              </div>
            </div>
            {it.estimated_score_impact ? (
              <div className="mt-2 text-xs text-white/60">Impact: {it.estimated_score_impact}</div>
            ) : null}
            {it.dispute_recommendation ? (
              <div className="mt-2 text-xs text-emerald-200/90">Action: {it.dispute_recommendation}</div>
            ) : null}
          </div>
        ))}

        {!loading && filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
            No negative items yet (or analysis_json is still hydrating).
          </div>
        ) : null}
      </div>
    </div>
  );
}
