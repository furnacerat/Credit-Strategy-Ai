'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';

type ReportRow = {
  id: string;
  status: string;
  progress: number;
  created_at: string;
  original_filename: string | null;
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return router.replace('/login');

      const { data, error } = await supabase
        .from('reports')
        .select('id,status,progress,created_at,original_filename')
        .order('created_at', { ascending: false })
        .limit(20);
      if (!mounted) return;
      if (error) {
        setReports([]);
      } else {
        setReports((data || []) as ReportRow[]);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Your reports</h1>
        </div>
        <div className="topbar__actions">
          <Link className="btn btn--ghost" href="/upload">
            Upload new PDF
          </Link>
          <button
            className="btn"
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <section className="grid">
        {loading ? (
          <div className="card"><p className="muted">Loading…</p></div>
        ) : reports.length === 0 ? (
          <div className="card">
            <h2>No uploads yet</h2>
            <p className="muted">Upload a credit report PDF to start analysis.</p>
            <Link className="btn" href="/upload">Upload PDF</Link>
          </div>
        ) : (
          reports.map((r) => (
            <Link key={r.id} className="card card--link" href={`/report/${r.id}`}>
              <div className="card__row">
                <div>
                  <p className="card__title">{r.original_filename || 'report.pdf'}</p>
                  <p className="muted">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <span className={`pill pill--${r.status}`}>{r.status}</span>
              </div>
              <div className="meter" aria-label="Progress">
                <div className="meter__bar" style={{ width: `${Math.max(0, Math.min(100, r.progress))}%` }} />
              </div>
            </Link>
          ))
        )}
      </section>
    </main>
  );
}
