'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';

const CreditDashboardMatrix = dynamic(() => import('@/components/CreditDashboardMatrix'), {
  ssr: false
});

type ReportRow = {
  id: string;
  status: string;
  created_at: string;
  original_filename: string | null;
  analysis_json: any | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [active, setActive] = useState<ReportRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return router.replace('/login');

      const { data, error } = await supabase
        .from('reports')
        .select('id,status,created_at,original_filename,analysis_json')
        .order('created_at', { ascending: false })
        .limit(20);
      if (!mounted) return;
      if (error) {
        setReports([]);
        setActive(null);
      } else {
        const rows = (data || []) as ReportRow[];
        setReports(rows);
        const best = rows.find((r) => r.analysis_json) || rows[0] || null;
        setActive(best);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  const activeId = active?.id || null;

  return (
    <div>
      <CreditDashboardMatrix
        analysis={active?.analysis_json}
        onOpenDisputeCenter={() => {
          if (activeId) router.push(`/report/${activeId}`);
          else router.push('/upload');
        }}
        onOpenAccounts={() => {
          if (activeId) router.push(`/report/${activeId}`);
          else router.push('/upload');
        }}
        onExportLetters={() => {
          if (activeId) router.push(`/report/${activeId}`);
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-10">
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-white/60">
            {loading ? 'Loading reports…' : `${reports.length} reports`}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/upload"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
            >
              Upload PDF
            </Link>
            <button
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/login');
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2">
          {reports.slice(0, 8).map((r) => (
            <button
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10"
              onClick={() => {
                setActive(r);
                router.push(`/report/${r.id}`);
              }}
            >
              <div>
                <div className="text-sm font-semibold text-white">{r.original_filename || 'report.pdf'}</div>
                <div className="text-xs text-white/50">{new Date(r.created_at).toLocaleString()}</div>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                {r.status}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
