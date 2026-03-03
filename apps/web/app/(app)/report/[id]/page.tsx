'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { getReport } from '@/lib/api';

const CreditDashboardMatrix = dynamic(() => import('@/components/CreditDashboardMatrix'), {
  ssr: false
});

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) router.replace('/login');
    })();
  }, [router, supabase]);

  useEffect(() => {
    let alive = true;
    let t: any;
    const tick = async () => {
      try {
        const res = await getReport(id);
        if (!alive) return;
        setData(res.report);
        setError(null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Failed to load report');
      }
      t = setTimeout(tick, 2000);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [id]);

  const analysis = data?.analysis_json || null;

  return (
    <div>
      <div className="relative mx-auto max-w-7xl px-4 pt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-white/55">Report ID: {id}</div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
            >
              Dashboard
            </Link>
            <Link
              href="/upload"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
            >
              Upload
            </Link>
          </div>
        </div>

        {data?.error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            Worker error: {data.error}
          </div>
        ) : null}
        {error ? (
          <div className="mt-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}
        {!analysis ? (
          <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
            Waiting for analysis_json… If this persists after processing, confirm the worker wrote `reports.analysis_json`.
          </div>
        ) : null}
      </div>

      <CreditDashboardMatrix
        analysis={analysis}
        onOpenDisputeCenter={() => {
          // Future: route to a dedicated Dispute Center.
        }}
        onOpenAccounts={() => {
          // Already on report.
        }}
        onExportLetters={() => {
          // Future: export approved drafts.
        }}
      />
    </div>
  );
}
