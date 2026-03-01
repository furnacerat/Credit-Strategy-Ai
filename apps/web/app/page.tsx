import Link from 'next/link';

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="hero__card">
          <p className="eyebrow">Credit report intelligence</p>
          <h1>Upload a report. Get clarity. Generate letters.</h1>
          <p className="muted">
            Secure upload to Supabase Storage, background parsing with OCR fallback, and dispute letter drafts
            stored privately for download.
          </p>
          <div className="hero__actions">
            <Link className="btn" href="/login">Sign in</Link>
            <Link className="btn btn--ghost" href="/dashboard">Dashboard</Link>
          </div>
        </div>
      </section>

      <section className="grid grid--three">
        <div className="card">
          <h2>Direct upload</h2>
          <p className="muted">Your PDF goes straight to secure storage (no server size limits).</p>
        </div>
        <div className="card">
          <h2>Digital-first + OCR</h2>
          <p className="muted">Fast extraction for normal PDFs, with OCR fallback for scanned pages.</p>
        </div>
        <div className="card">
          <h2>Letters generated</h2>
          <p className="muted">Download bureau-specific drafts when processing completes.</p>
        </div>
      </section>
    </main>
  );
}
