import Link from 'next/link';

export default function Home() {
  return (
    <div>
      <div className="topbar">
        <div>
          <p className="eyebrow">Personal cabinet</p>
          <h1>Credit Strategy AI</h1>
          <p className="muted">
            Upload a credit report PDF, review the AI action list, then approve bureau-specific dispute letter drafts.
          </p>
        </div>
        <div className="topbar__actions">
          <Link className="btn" href="/login">Sign in</Link>
          <Link className="btn btn--ghost" href="/dashboard">Open dashboard</Link>
        </div>
      </div>

      <section className="grid grid--two">
        <div className="hero__card">
          <p className="eyebrow">Workflow</p>
          <h2 style={{ marginTop: 0 }}>From PDF to approved letters</h2>
          <div className="kv">
            <div className="kv__row"><span className="muted">1</span><span>Upload a PDF (up to ~50MB)</span></div>
            <div className="kv__row"><span className="muted">2</span><span>AI identifies dispute-relevant items</span></div>
            <div className="kv__row"><span className="muted">3</span><span>You choose what to include</span></div>
            <div className="kv__row"><span className="muted">4</span><span>Draft letters generated for review</span></div>
          </div>
          <div className="hero__actions">
            <Link className="btn" href="/upload">Upload a report</Link>
            <Link className="btn btn--ghost" href="/dashboard">View reports</Link>
          </div>
          <p className="fineprint">
            Drafts are not sent automatically. You approve before anything becomes final.
          </p>
        </div>

        <div className="grid grid--two" style={{ marginTop: 0 }}>
          <div className="card">
            <p className="eyebrow" style={{ marginBottom: 6 }}>Direct upload</p>
            <p className="card__title">Secure storage</p>
            <p className="muted">Large PDFs upload directly to Supabase Storage.</p>
          </div>
          <div className="card">
            <p className="eyebrow" style={{ marginBottom: 6 }}>Parsing</p>
            <p className="card__title">Digital-first + OCR</p>
            <p className="muted">Fast text extraction with OCR fallback for scans.</p>
          </div>
          <div className="card">
            <p className="eyebrow" style={{ marginBottom: 6 }}>Decisions</p>
            <p className="card__title">AI action list</p>
            <p className="muted">Risk + evidence suggestions per item.</p>
          </div>
          <div className="card">
            <p className="eyebrow" style={{ marginBottom: 6 }}>Letters</p>
            <p className="card__title">Item-specific drafts</p>
            <p className="muted">Creditor/account/date/amount references per dispute.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
