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

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (!data) return;
    // Debug hook: confirm analysis JSON exists and keys are correct.
    // eslint-disable-next-line no-console
    console.log('report.analysis_json', data.analysis_json);
  }, [data]);

  const status = data?.status || 'unknown';
  const progress = typeof data?.progress === 'number' ? data.progress : 0;
  const letters: Letter[] = (data?.dispute_letters || []) as any;
  const analysis = data?.analysis_json as any;
  const items = (data?.report_items || []) as any[];

  const counts = (analysis?.counts || analysis?.credit_summary?.counts || {}) as Record<string, number>;
  const accounts = (analysis?.accounts || []) as any[];
  const disputeStrategies = (analysis?.dispute_strategies || []) as any[];
  const aiLetters = (analysis?.dispute_letters || []) as any[];

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

        {!analysis ? (
          <p className="fineprint">
            Debug: `analysis_json` is empty. Confirm: (1) Supabase migration added `reports.analysis_json`, (2)
            worker has `OPENAI_API_KEY`, (3) worker logs show OpenAI extraction ran, (4) this API route returns
            `analysis_json`.
          </p>
        ) : null}
      </section>

      <section className="grid grid--two">
        <div className="card">
          <h2>Analysis</h2>
          {analysis ? (
            <div className="kv">
              <div className="kv__row"><span className="muted">Score range</span><span>{analysis.credit_summary?.estimated_score_range ?? '—'}</span></div>
              <div className="kv__row"><span className="muted">Total accounts</span><span>{analysis.credit_summary?.total_accounts ?? accounts.length ?? '—'}</span></div>
              <div className="kv__row"><span className="muted">Negative items</span><span>{analysis.credit_summary?.negative_accounts_count ?? analysis.negative_items?.length ?? '—'}</span></div>
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
        <h2>Account breakdown</h2>
        {accounts.length === 0 ? (
          <p className="muted">No accounts extracted yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  {[
                    'Creditor',
                    'Type',
                    'Bureau',
                    'Status',
                    'Balance',
                    'Limit',
                    'Util %',
                    'Late',
                    'Flags'
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '10px 10px',
                        borderBottom: '1px solid rgba(255,255,255,0.12)',
                        color: 'rgba(255,255,255,0.72)',
                        fontWeight: 700,
                        fontSize: '0.9rem'
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {accounts.slice(0, 50).map((a, idx) => {
                  const creditor = a.creditor_name || a.creditor || a.furnisher || '—';
                  const type = a.account_type || a.type || '—';
                  const bureau = a.bureau || '—';
                  const status = a.status || a.account_status || '—';
                  const balance = a.balance ?? null;
                  const limit = a.credit_limit ?? a.limit ?? null;
                  const util =
                    a.utilization_percentage ??
                    (balance != null && limit ? Math.round((Number(balance) / Number(limit)) * 100) : null);
                  const late = a.late_payments || a.lates || null;
                  const flags: string[] = [];
                  if (a.derogatory_flag) flags.push('derog');
                  if (a.charge_off_flag) flags.push('charge-off');
                  if (a.collection_flag) flags.push('collection');
                  if (a.past_due_amount) flags.push('past-due');

                  return (
                    <tr key={idx}>
                      <td style={{ padding: '10px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{creditor}</td>
                      <td style={{ padding: '10px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{type}</td>
                      <td style={{ padding: '10px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{bureau}</td>
                      <td style={{ padding: '10px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{status}</td>
                      <td style={{ padding: '10px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{balance ?? '—'}</td>
                      <td style={{ padding: '10px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{limit ?? '—'}</td>
                      <td style={{ padding: '10px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{util != null ? `${util}%` : '—'}</td>
                      <td style={{ padding: '10px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{late ? JSON.stringify(late) : '—'}</td>
                      <td style={{ padding: '10px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        {flags.length ? flags.join(', ') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {accounts.length > 50 ? <p className="fineprint">Showing first 50 accounts.</p> : null}
          </div>
        )}
      </section>

      <section className="grid grid--two">
        <div className="card">
          <h2>Dispute strategies</h2>
          {disputeStrategies.length === 0 ? (
            <p className="muted">No strategies yet.</p>
          ) : (
            <div className="letters" style={{ marginTop: 10 }}>
              {disputeStrategies.slice(0, 12).map((s, i) => (
                <div key={i} className="letter" style={{ cursor: 'default' }}>
                  <div>
                    <p className="card__title">{s.creditor_name || s.creditor || 'Strategy'}</p>
                    <p className="muted">{s.dispute_type || '—'} • {s.success_probability || '—'}</p>
                    <p className="muted" style={{ marginTop: 8 }}>{s.dispute_reason || s.reason || ''}</p>
                  </div>
                  <span className="pill pill--processing">{s.impact_level || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2>AI letters (draft content)</h2>
          {aiLetters.length === 0 ? (
            <p className="muted">No AI letters in analysis JSON yet.</p>
          ) : (
            <div className="letters" style={{ marginTop: 10 }}>
              {aiLetters.slice(0, 6).map((l, i) => (
                <details key={i} style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: 12, background: 'rgba(255,255,255,0.05)' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 750 }}>{l.bureau || l.credit_bureau || `Letter ${i + 1}`}</summary>
                  <pre className="mono" style={{ whiteSpace: 'pre-wrap', marginTop: 10 }}>{l.content || l.letter || JSON.stringify(l, null, 2)}</pre>
                </details>
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
