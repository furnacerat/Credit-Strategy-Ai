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
  const items = (data?.report_items || []) as any[];

  const counts = (analysis?.counts || {}) as Record<string, number>;

  return (
    <div>
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
              <div className="kv__row"><span className="muted">Late payments</span><span>{counts.late_payment ?? 0}</span></div>
              <div className="kv__row"><span className="muted">Charge offs</span><span>{counts.charge_off ?? 0}</span></div>
              <div className="kv__row"><span className="muted">Collections</span><span>{counts.collection ?? 0}</span></div>
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

      <section className="card">
        <h2>Items found</h2>
        {items.length === 0 ? (
          <p className="muted">No items extracted yet.</p>
        ) : (
          <div className="letters">
            {items.slice(0, 30).map((it) => {
              const ai = it.report_item_ai?.[0];
              const sel = it.report_item_selection?.[0];
              const recommendation = ai?.recommendation || 'needs_review';
              const risk = ai?.risk_level || 'medium';
              const selected = !!sel?.selected;

              return (
                <div key={it.id} className="letter" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <p className="card__title">{String(it.category || '').replace(/_/g, ' ')}</p>
                    <p className="muted">
                      {it.creditor ? `${it.creditor} • ` : ''}
                      {it.account_ref ? `${it.account_ref} • ` : ''}
                      {it.occurred_on ? `${it.occurred_on} • ` : ''}
                      {it.amount != null ? `$${it.amount} • ` : ''}
                      {it.page_number ? `p${it.page_number}` : ''}
                    </p>
                    {ai?.rationale ? <p className="muted" style={{ marginTop: 8 }}>{ai.rationale}</p> : null}
                    {ai?.evidence_needed?.length ? (
                      <p className="fineprint">Evidence: {ai.evidence_needed.slice(0, 3).join('; ')}</p>
                    ) : null}
                  </div>

                  <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                    <span className={`pill pill--${recommendation === 'dispute' ? 'complete' : recommendation === 'do_not_dispute' ? 'failed' : 'queued'}`}>
                      {recommendation}
                    </span>
                    <span className="pill pill--processing">risk {risk}</span>
                    <label className="pill" style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={async (e) => {
                          // Update selection via RLS (client-side).
                          const supabase = supabaseBrowser();
                          await supabase.from('report_item_selection').upsert({
                            report_id: id,
                            item_id: it.id,
                            selected: e.target.checked
                          });
                        }}
                        style={{ marginRight: 8 }}
                      />
                      include
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {items.length > 30 ? <p className="fineprint">Showing first 30 items.</p> : null}
      </section>

      <section className="card">
        <div className="card__row" style={{ alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Letter drafts</h2>
          <button
            className="btn"
            onClick={async () => {
              const supabase = supabaseBrowser();
              const { data } = await supabase.auth.getSession();
              const token = data.session?.access_token;
              if (!token) return;
              await fetch('/api/reports/generate-drafts', {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ report_id: id })
              });
            }}
          >
            Regenerate drafts
          </button>
        </div>

        {data?.letter_drafts?.length ? (
          <div className="letters" style={{ marginTop: 10 }}>
            {data.letter_drafts
              .filter((d: any) => d.status === 'draft')
              .slice(0, 3)
              .map((d: any) => (
                <details key={d.id} style={{ border: '1px solid rgba(20, 18, 14, 0.12)', borderRadius: 16, padding: 12, background: 'rgba(255,255,255,0.55)' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 750 }}>{d.bureau} (draft)</summary>
                  <pre className="mono" style={{ whiteSpace: 'pre-wrap', marginTop: 10 }}>{d.content}</pre>
                  <p className="fineprint">User approval step will be added next.</p>
                </details>
              ))}
          </div>
        ) : (
          <p className="muted">No drafts yet.</p>
        )}
      </section>
    </div>
  );
}
