'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';
import { enqueueReport, initiateReportUpload, uploadToSignedUrl } from '@/lib/api';

export default function UploadPage() {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<'pick' | 'sign' | 'upload' | 'enqueue' | 'done'>('pick');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function ensureAuth() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) router.replace('/login');
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-2">
          <div>
            <div className="text-xs text-white/55">UPLOAD</div>
            <h1 className="mt-1 text-2xl font-semibold">Upload your credit report PDF</h1>
            <p className="mt-2 text-sm text-white/60">Direct upload to secure storage, then background processing.</p>
          </div>
          <button
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
            onClick={() => router.push('/dashboard')}
          >
            Back
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <input
            className="w-full rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-400/10 file:px-4 file:py-2 file:text-emerald-100 hover:bg-black/30"
            type="file"
            accept="application/pdf,.pdf,.PDF"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              setFile(f);
              setError(null);
              setProgress(0);
              setStep('pick');
            }}
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Selected file</div>
              <div className="text-xs text-white/55">
                {file ? `${file.name} • ${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'Choose a PDF to begin.'}
              </div>
            </div>

            <button
              className="inline-flex items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-400/15 disabled:opacity-60"
              disabled={!file || step !== 'pick'}
              onClick={async () => {
                if (!file) return;
                await ensureAuth();
                setError(null);

                try {
                  setStep('sign');
                  const init = await initiateReportUpload(file);

                  setStep('upload');
                  await uploadToSignedUrl(init.signed_upload.signedUrl, file, setProgress);
                  setProgress(100);

                  setStep('enqueue');
                  await enqueueReport(init.report_id);

                  setStep('done');
                  router.push(`/report/${init.report_id}`);
                } catch (e: any) {
                  setError(e?.message || 'Something went wrong');
                  setStep('pick');
                }
              }}
            >
              {step === 'pick'
                ? 'Start upload'
                : step === 'sign'
                  ? 'Preparing…'
                  : step === 'upload'
                    ? `Uploading ${progress}%…`
                    : step === 'enqueue'
                      ? 'Queueing…'
                      : 'Done'}
            </button>
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full border border-white/10 bg-white/5">
            <div
              className="h-full bg-emerald-400/60"
              style={{ width: `${step === 'upload' ? progress : step === 'done' ? 100 : progress}%` }}
            />
          </div>

          {error ? <div className="mt-3 text-sm text-red-200">{error}</div> : null}
          <div className="mt-3 text-xs text-white/55">
            Tip: PDFs up to ~50MB are supported. Scanned reports may take longer due to OCR.
          </div>
        </div>
      </div>
    </div>
  );
}
