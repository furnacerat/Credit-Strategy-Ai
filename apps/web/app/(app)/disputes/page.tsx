'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseBrowser } from '@/lib/supabase';
import { signLetterDownload } from '@/lib/api';

type Draft = {
  id: string;
  bureau: string;
  status: 'draft' | 'approved' | 'superseded' | string;
  content: string;
  created_at: string;
  approved_at: string | null;
};

type FinalLetter = {
  id: string;
  bureau: string;
  created_at: string;
};

async function authedFetch(path: string, body: any) {
  const supabase = supabaseBrowser();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error || `Request failed (${res.status})`);
  }
  return res.json().catch(() => ({}));
}

export default function DisputesPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [reportId, setReportId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [finals, setFinals] = useState<FinalLetter[]>([]);
  const [active, setActive] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) return router.push('/login');

      const { data, error } = await supabase
        .from('reports')
        .select('id,letter_drafts(id,bureau,status,content,created_at,approved_at),dispute_letters(id,bureau,created_at)')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        setError(error.message);
        return;
      }
      const row = (data || [])[0];
      if (!row?.id) return router.push('/upload');
      setReportId(row.id);
      const ds = (row.letter_drafts || []) as Draft[];
      setDrafts(ds.filter((d) => d.status === 'draft'));
      setFinals((row.dispute_letters || []) as FinalLetter[]);
      setActive(ds.find((d) => d.status === 'draft') || null);
    })();
  }, [router, supabase]);

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-xs text-white/55">DISPUTE CENTER</div>
          <h1 className="mt-1 text-2xl font-semibold">Letters</h1>
          <div className="mt-1 text-sm text-white/60">Edit drafts, approve, export PDFs, and track status.</div>
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

      {error ? <div className="mb-3 text-sm text-red-200">{error}</div> : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold">Drafts</div>
            <div className="mt-2 grid grid-cols-1 gap-2">
              {drafts.map((d) => (
                <button
                  key={d.id}
                  className={`w-full rounded-2xl border px-4 py-3 text-left text-sm hover:bg-white/5 ${
                    active?.id === d.id ? 'border-emerald-400/25 bg-emerald-400/10' : 'border-white/10 bg-black/40'
                  }`}
                  onClick={() => setActive(d)}
                >
                  <div className="font-semibold">{d.bureau}</div>
                  <div className="mt-1 text-xs text-white/55">{new Date(d.created_at).toLocaleString()}</div>
                </button>
              ))}
              {drafts.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/60">
                  No drafts yet. Upload a report and let the worker generate drafts.
                </div>
              ) : null}
            </div>

            <div className="mt-4 text-sm font-semibold">Exports</div>
            <div className="mt-2 grid grid-cols-1 gap-2">
              {finals.map((l) => (
                <button
                  key={l.id}
                  className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-left text-sm hover:bg-white/5"
                  onClick={async () => {
                    const url = await signLetterDownload(l.id);
                    window.open(url, '_blank', 'noopener,noreferrer');
                  }}
                >
                  <div>
                    <div className="font-semibold">{l.bureau}</div>
                    <div className="mt-1 text-xs text-white/55">{new Date(l.created_at).toLocaleString()}</div>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                    PDF
                  </span>
                </button>
              ))}
              {finals.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/60">
                  No exported PDFs yet.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">Editor</div>
                <div className="text-xs text-white/55">
                  {active ? `${active.bureau} draft` : 'Select a draft'}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/profile"
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                >
                  Profile
                </Link>
                <button
                  disabled={!active || busy !== null}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-60"
                  onClick={async () => {
                    if (!active) return;
                    await navigator.clipboard.writeText(active.content || '');
                  }}
                >
                  Copy
                </button>
                <button
                  disabled={!active || busy !== null}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-60"
                  onClick={async () => {
                    if (!active) return;
                    setBusy('save');
                    setError(null);
                    try {
                      await authedFetch('/api/letter-drafts/update', {
                        draft_id: active.id,
                        content: active.content
                      });
                    } catch (e: any) {
                      setError(e.message);
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  Save
                </button>
                <button
                  disabled={!active || busy !== null}
                  className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100 hover:bg-emerald-400/15 disabled:opacity-60"
                  onClick={async () => {
                    if (!active) return;
                    setBusy('export');
                    setError(null);
                    try {
                      const out = await authedFetch('/api/letters/export', { draft_id: active.id });
                      if (out?.letter_id) {
                        const { data, error } = await supabase
                          .from('reports')
                          .select('dispute_letters(id,bureau,created_at)')
                          .eq('id', reportId)
                          .single();
                        if (!error) setFinals((data?.dispute_letters || []) as any);
                      }
                      if (out?.url) window.open(out.url, '_blank', 'noopener,noreferrer');
                    } catch (e: any) {
                      setError(e.message);
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  Export PDF
                </button>
              </div>
            </div>

            {active ? (
              <textarea
                value={active.content}
                onChange={(e) => setActive((d) => (d ? { ...d, content: e.target.value } : d))}
                className="mt-3 h-[520px] w-full rounded-2xl border border-white/10 bg-black/40 p-4 font-mono text-xs text-white/80 outline-none focus:border-emerald-400/30"
              />
            ) : (
              <div className="mt-3 rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-white/60">
                Select a draft on the left.
              </div>
            )}

            <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/60">
              Attachments checklist (coming next): ID, proof of address, supporting docs.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
