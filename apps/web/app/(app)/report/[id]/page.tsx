'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { getReport, signReportDownload } from '@/lib/api';

type ReportItem = {
  id: string;
  bureau: string | null;
  category: string;
  creditor: string | null;
  account_ref: string | null;
  occurred_on: string | null;
  amount: number | null;
  confidence: number | null;
  page_number: number | null;
  raw_text: string | null;
};

export default function ReportViewerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const [page, setPage] = useState<number>(1);
  const [pageText, setPageText] = useState<string>('');
  const [activeItem, setActiveItem] = useState<ReportItem | null>(null);

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

        if (!pdfUrl) {
          try {
            const url = await signReportDownload(id);
            if (!alive) return;
            setPdfUrl(url);
          } catch {
            // Viewer still works without embedding the PDF.
          }
        }
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Failed to load report');
      }
      t = setTimeout(tick, 2500);
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    (async () => {
      if (!data?.id) return;
      const { data: row, error } = await supabase
        .from('report_pages')
        .select('text')
        .eq('report_id', data.id)
        .eq('page_number', page)
        .single();
      if (error || !row) {
        setPageText('');
        return;
      }
      setPageText(String(row.text || ''));
    })();
  }, [data?.id, page, supabase]);

  const analysis = data?.analysis_json || null;
  const items: ReportItem[] = Array.isArray(data?.report_items) ? data.report_items : [];

  const pages = Number(analysis?.credit_summary?.pages || 0) || null;
  const ocrPages = Number(analysis?.credit_summary?.ocr_pages || 0) || null;
  const totalChars = Number(analysis?.credit_summary?.total_chars || 0) || null;

  const missing: string[] = [];
  if (analysis && analysis.credit_summary?.score == null) missing.push('score');
  if (analysis && analysis.utilization?.utilization_percentage == null) missing.push('utilization');
  if (analysis && (!Array.isArray(analysis.accounts) || analysis.accounts.length === 0)) missing.push('accounts');
  if (analysis && (!Array.isArray(analysis.negative_items) || analysis.negative_items.length === 0)) missing.push('negative_items');
  if (analysis && (!Array.isArray(analysis.priority_issues) || analysis.priority_issues.length === 0)) missing.push('priority_issues');
  if (analysis && (!Array.isArray(analysis.dispute_letters) || analysis.dispute_letters.length === 0)) missing.push('dispute_letters');

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-xs text-white/55">REPORT VIEWER</div>
          <h1 className="mt-1 text-2xl font-semibold">{data?.original_filename || 'credit report.pdf'}</h1>
          <div className="mt-1 text-sm text-white/60">
            {data?.created_at ? `Uploaded ${new Date(data.created_at).toLocaleString()}` : ''}
            {data?.status ? ` • ${data.status}` : ''}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
          >
            Dashboard
          </Link>
          <Link
            href="/issues"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
          >
            Issues
          </Link>
          <Link
            href="/disputes"
            className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-400/15"
          >
            Dispute Center
          </Link>
        </div>
      </div>

      {data?.error ? (
        <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
          Worker error: {data.error}
        </div>
      ) : null}
      {error ? (
        <div className="mb-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">PDF</div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-xs text-white/55">Page</div>
                <input
                  type="number"
                  min={1}
                  value={page}
                  onChange={(e) => setPage(Math.max(1, Number(e.target.value || 1)))}
                  className="w-20 rounded-2xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-emerald-400/30"
                />
                {pages ? <div className="text-xs text-white/55">of {pages}</div> : null}
              </div>
            </div>

            {pdfUrl ? (
              <iframe
                className="mt-3 h-[720px] w-full rounded-2xl border border-white/10 bg-black/40"
                src={`${pdfUrl}#page=${page}`}
              />
            ) : (
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-white/60">
                PDF viewer unavailable (could not sign download).
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold">Extracted data</div>
            <div className="mt-2 text-xs text-white/55">Click an item to jump to its page.</div>

            <div className="mt-3 max-h-[260px] overflow-auto rounded-2xl border border-white/10">
              {items.slice(0, 200).map((it) => (
                <button
                  key={it.id}
                  className="w-full border-t border-white/10 bg-black/30 px-3 py-3 text-left text-sm hover:bg-white/5"
                  onClick={() => {
                    setActiveItem(it);
                    if (it.page_number) setPage(it.page_number);
                  }}
                >
                  <div className="font-semibold text-white">
                    {it.category.replace(/_/g, ' ')}{it.creditor ? ` • ${it.creditor}` : ''}
                  </div>
                  <div className="mt-1 text-xs text-white/55">
                    {(it.bureau || '—').toUpperCase()} • p{it.page_number ?? '—'} • conf {it.confidence ?? '—'}
                  </div>
                </button>
              ))}
              {items.length === 0 ? (
                <div className="p-4 text-sm text-white/60">No extracted items yet.</div>
              ) : null}
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs font-semibold text-white/80">Page {page} text</div>
              <pre className="mt-2 max-h-[200px] overflow-auto whitespace-pre-wrap text-xs text-white/70">
                {pageText || 'No text for this page yet.'}
              </pre>
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-xs font-semibold text-white/80">Confidence flags</div>
              <div className="mt-2 text-xs text-white/60">
                {pages != null ? `Pages: ${pages}` : 'Pages: —'}
                {ocrPages != null ? ` • OCR pages: ${ocrPages}` : ''}
                {totalChars != null ? ` • Extracted chars: ${totalChars}` : ''}
              </div>
              {missing.length ? (
                <div className="mt-2 text-xs text-emerald-200/90">Missing metrics: {missing.join(', ')}</div>
              ) : (
                <div className="mt-2 text-xs text-white/55">All key metrics present.</div>
              )}
              {activeItem?.raw_text ? (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-white/80">Source snippet</div>
                  <pre className="mt-2 max-h-[140px] overflow-auto whitespace-pre-wrap text-xs text-white/70">
                    {activeItem.raw_text}
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
