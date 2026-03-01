'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { getReport, signLetterDownload } from '@/lib/api';

type Letter = {
  id: string;
  bureau: string;
  storage_bucket: string;
  storage_path: string;
  created_at: string;
};

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

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

  const status = data?.status || 'unknown';
  const progress = typeof data?.progress === 'number' ? data.progress : 0;
  const letters: Letter[] = (data?.dispute_letters || []) as any;
  const analysis = data?.report_analysis?.result;

  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <p className="eyebrow">Report</p>
          <h1>Processing status</h1>
          <p className="muted">This page refreshes automatically every couple seconds.</p>
        </div>
        <div className="topbar__actions">
          <Link className="btn btn--ghost" href="/dashboard">Dashboard</Link>
          <Link className="btn" href="/upload">Upload another</Link>
        </div>
      </div>

      <section className="card">
        <div className="card__row">
          <div>
            <p className="card__title">Report ID</p>
            <p className="mono">{id}</p>
          </div>
          <span className={`pill pill--${status}`}>{status}</span>
        </div>

        <div className="meter meter--big" aria-label="Processing progress">
          <div className="meter__bar" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
        <p className="muted">{progress}%</p>

        {data?.error ? <p className="error">Worker error: {data.error}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="grid grid--two">
        <div className="card">
          <h2>Analysis</h2>
          {analysis ? (
            <div className="kv">
              <div className="kv__row"><span className="muted">Pages</span><span>{analysis.pages ?? '—'}</span></div>
              <div className="kv__row"><span className="muted">OCR pages</span><span>{analysis.ocr_pages ?? '—'}</span></div>
              <div className="kv__row"><span className="muted">Extracted chars</span><span>{analysis.total_chars ?? '—'}</span></div>
            </div>
          ) : (
            <p className="muted">No analysis yet.</p>
          )}
        </div>

        <div className="card">
          <h2>Dispute letters</h2>
          {letters.length === 0 ? (
            <p className="muted">No letters generated yet.</p>
          ) : (
            <div className="letters">
              {letters.map((l) => (
                <button
                  key={l.id}
                  className="letter"
                  disabled={downloading === l.id}
                  onClick={async () => {
                    try {
                      setDownloading(l.id);
                      const url = await signLetterDownload(l.id);
                      window.open(url, '_blank', 'noopener,noreferrer');
                    } finally {
                      setDownloading(null);
                    }
                  }}
                >
                  <div>
                    <p className="card__title">{l.bureau}</p>
                    <p className="muted">{new Date(l.created_at).toLocaleString()}</p>
                  </div>
                  <span className="pill pill--ready">Download</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
