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
    <div>
      <div className="topbar">
        <div>
          <p className="eyebrow">Personal cabinet</p>
          <h1>Credit dashboard</h1>
        </div>
        <div className="topbar__actions">
          <Link className="btn" href="/upload">Upload PDF</Link>
          <button
            className="btn btn--ghost"
            onClick={async () => {
              await supabase.auth.signOut();
              router.push('/login');
            }}
          >
            Sign out
          </button>
        </div>
      </div>

      <section className="grid grid--four">
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 6 }}>Reports</p>
          <p className="card__title">{loading ? '—' : reports.length}</p>
          <p className="muted">Total uploads</p>
        </div>
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 6 }}>Queued</p>
          <p className="card__title">
            {loading ? '—' : reports.filter((r) => r.status === 'queued' || r.status === 'uploaded').length}
          </p>
          <p className="muted">Waiting for worker</p>
        </div>
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 6 }}>Processing</p>
          <p className="card__title">{loading ? '—' : reports.filter((r) => r.status === 'processing').length}</p>
          <p className="muted">In progress</p>
        </div>
        <div className="card">
          <p className="eyebrow" style={{ marginBottom: 6 }}>Complete</p>
          <p className="card__title">{loading ? '—' : reports.filter((r) => r.status === 'complete').length}</p>
          <p className="muted">Ready to review</p>
        </div>
      </section>

      <section className="grid grid--two" style={{ marginTop: 14 }}>
        {loading ? (
          <div className="card"><p className="muted">Loading…</p></div>
        ) : reports.length === 0 ? (
          <div className="card">
            <h2>No uploads yet</h2>
            <p className="muted">Upload a credit report PDF to start analysis.</p>
            <Link className="btn" href="/upload">Upload PDF</Link>
          </div>
        ) : (
          <>
            <div className="card">
              <div className="card__row">
                <h2 style={{ margin: 0 }}>Recent reports</h2>
                <span className="pill pill--processing">auto-refresh later</span>
              </div>
              <div className="letters" style={{ marginTop: 10 }}>
                {reports.slice(0, 8).map((r) => (
                  <Link key={r.id} className="letter" href={`/report/${r.id}`}>
                    <div>
                      <p className="card__title">{r.original_filename || 'report.pdf'}</p>
                      <p className="muted">{new Date(r.created_at).toLocaleString()}</p>
                    </div>
                    <span className={`pill pill--${r.status}`}>{r.status}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="card">
              <h2>Quick actions</h2>
              <p className="muted">Next best steps for this workflow.</p>
              <div className="letters" style={{ marginTop: 10 }}>
                <Link className="letter" href="/upload">
                  <div>
                    <p className="card__title">Upload a new report</p>
                    <p className="muted">PDF up to ~50MB</p>
                  </div>
                  <span className="pill pill--complete">Start</span>
                </Link>
                <div className="letter" style={{ cursor: 'default' }}>
                  <div>
                    <p className="card__title">Review AI action list</p>
                    <p className="muted">Approve what goes into drafts</p>
                  </div>
                  <span className="pill pill--queued">Next</span>
                </div>
                <div className="letter" style={{ cursor: 'default' }}>
                  <div>
                    <p className="card__title">Approve letters</p>
                    <p className="muted">Generate final downloads</p>
                  </div>
                  <span className="pill pill--queued">Soon</span>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
