'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';

type Acct = {
  creditor_name?: string | null;
  bureau?: string | null;
  account_type?: string | null;
  status?: string | null;
  payment_status?: string | null;
  balance?: number | null;
  credit_limit?: number | null;
  past_due_amount?: number | null;
  derogatory_flag?: boolean | null;
  charge_off_flag?: boolean | null;
  collection_flag?: boolean | null;
  date_opened?: string | null;
  last_activity_date?: string | null;
};

function money(n?: number | null) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export default function AccountsPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [loading, setLoading] = useState(true);
  const [reportId, setReportId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyNegative, setOnlyNegative] = useState(false);

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

  const accounts: Acct[] = Array.isArray(analysis?.accounts) ? analysis.accounts : [];
  const filtered = accounts.filter((a) => {
    if (!onlyNegative) return true;
    return !!(a.derogatory_flag || a.charge_off_flag || a.collection_flag || (a.past_due_amount ?? 0) > 0);
  });

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-xs text-white/55">ACCOUNTS</div>
          <h1 className="mt-1 text-2xl font-semibold">Tradelines</h1>
          <div className="mt-1 text-sm text-white/60">Open/closed, balances/limits, utilization signals, flags.</div>
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
        <button
          className={`rounded-2xl border px-3 py-2 text-sm ${
            onlyNegative
              ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
              : 'border-white/10 bg-white/5 text-white/80'
          }`}
          onClick={() => setOnlyNegative((v) => !v)}
        >
          High risk only
        </button>
        <div className="text-xs text-white/55">{loading ? 'Loading…' : `${filtered.length} accounts`}</div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="grid grid-cols-12 bg-white/5 px-3 py-2 text-[11px] text-white/60">
          <div className="col-span-4">Creditor</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Balance</div>
          <div className="col-span-2 text-right">Limit</div>
        </div>
        <div className="max-h-[520px] overflow-auto">
          {filtered.map((a, idx) => {
            const flagged = !!(a.derogatory_flag || a.charge_off_flag || a.collection_flag || (a.past_due_amount ?? 0) > 0);
            return (
              <div
                key={idx}
                className="grid grid-cols-12 items-center border-t border-white/10 px-3 py-3 text-sm hover:bg-white/5"
              >
                <div className="col-span-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] ${
                        flagged
                          ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                          : 'border-white/10 bg-white/5 text-white/70'
                      }`}
                    >
                      {flagged ? 'FLAGGED' : 'OK'}
                    </span>
                    <div className="font-semibold text-white">{a.creditor_name ?? 'Unknown'}</div>
                  </div>
                  <div className="mt-1 text-[11px] text-white/50">
                    {(a.bureau ?? '—').toUpperCase()} • Opened {a.date_opened ?? '—'} • Activity {a.last_activity_date ?? '—'}
                  </div>
                </div>
                <div className="col-span-2 text-white/75">{a.account_type ?? '—'}</div>
                <div className="col-span-2 text-white/75">{a.status ?? a.payment_status ?? '—'}</div>
                <div className="col-span-2 text-right font-semibold text-white">{money(a.balance)}</div>
                <div className="col-span-2 text-right text-white/75">{money(a.credit_limit)}</div>
              </div>
            );
          })}

          {!loading && filtered.length === 0 ? (
            <div className="p-6 text-sm text-white/60">No accounts yet (or analysis_json.accounts is empty).</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
