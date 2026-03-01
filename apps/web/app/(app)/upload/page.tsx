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
    <main className="shell">
      <div className="topbar">
        <div>
          <p className="eyebrow">Upload</p>
          <h1>Upload your credit report PDF</h1>
          <p className="muted">
            We upload directly to secure storage, then process it in the background.
          </p>
        </div>
      </div>

      <section className="card">
        <div className="uploader">
          <input
            className="uploader__input"
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

          <div className="uploader__meta">
            <p className="card__title">Selected file</p>
            <p className="muted">
              {file ? `${file.name} • ${(file.size / (1024 * 1024)).toFixed(2)} MB` : 'Choose a PDF to begin.'}
            </p>
          </div>

          <div className="uploader__actions">
            <button
              className="btn"
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

            <button className="btn btn--ghost" onClick={() => router.push('/dashboard')}>
              Back
            </button>
          </div>

          {step === 'upload' ? (
            <div className="meter meter--big" aria-label="Upload progress">
              <div className="meter__bar" style={{ width: `${progress}%` }} />
            </div>
          ) : null}

          {error ? <p className="error">{error}</p> : null}
          <p className="fineprint">
            Tip: PDFs up to ~50MB are supported. If your report is scanned, OCR may take longer.
          </p>
        </div>
      </section>
    </main>
  );
}
