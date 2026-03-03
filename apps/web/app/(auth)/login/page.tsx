'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard');
    });
  }, [router, supabase.auth]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-[-180px] right-[-120px] h-[520px] w-[520px] rounded-full bg-emerald-400/[0.08] blur-3xl" />
      </div>

      <div className="relative mx-auto flex max-w-md flex-col px-4 py-10">
        <div className="mb-6">
          <div className="text-xs text-white/55">WELCOME BACK</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm text-white/60">
            Upload your report, review AI recommendations, approve letter drafts.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError(null);
              const { error: err } = await supabase.auth.signInWithPassword({ email, password });
              setBusy(false);
              if (err) return setError(err.message);
              router.push('/dashboard');
            }}
          >
            <label className="block">
              <span className="text-xs text-white/60">Email</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-emerald-400/30"
              />
            </label>

            <label className="block">
              <span className="text-xs text-white/60">Password</span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/30"
              />
            </label>

            {error ? <div className="text-sm text-red-200">{error}</div> : null}

            <button
              className="inline-flex w-full items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100 hover:bg-emerald-400/15 disabled:opacity-60"
              type="submit"
              disabled={busy}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>

            <div className="text-xs text-white/55">
              No account? Create a user in Supabase Auth for now.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
